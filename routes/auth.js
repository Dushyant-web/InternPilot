const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/sendEmail');

router.get('/login', (req, res) => res.render('auth/login'));
router.get('/register', (req, res) => res.render('auth/register'));

router.post('/register', async (req, res) => {
    const { name, email, password, role, adminSecretKey, companyName, cin, industry } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    console.log('\n--- New Registration Request ---');
    console.log('Received Payload Email:', normalizedEmail);

    try {
        if (!normalizedEmail) {
            console.error('ERROR: Email field is empty or missing in req.body!');
            req.flash('error_msg', 'Email address is required.');
            return res.redirect('/auth/register');
        }

        const existing = await User.findOne({ email: normalizedEmail });

        // If user already exists in DB
        if (existing) {
            if (existing.isEmailVerified) {
                console.log('Status: User exists and is already verified.');
                req.flash('error_msg', 'Email already registered. Please log in.');
                return res.redirect('/auth/register');
            } else {
                console.log('Status: User exists but is unverified. Resending fresh OTP...');
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                existing.otp = otp;
                existing.otpExpires = Date.now() + 10 * 60 * 1000;
                existing.lastOtpSentAt = Date.now();

                if (password) existing.password = password; // Update password if provided

                await sendOTPEmail(normalizedEmail, otp);
                await existing.save();

                console.log(`--> Fresh OTP (${otp}) successfully sent to: ${normalizedEmail}`);
                req.flash('success_msg', 'A new verification code has been sent to your email.');
                return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
            }
        }

        let selectedRole = 'candidate';

        if (role === 'admin') {
            const SYSTEM_ADMIN_SECRET = process.env.ADMIN_SECRET || 'SUPER_SECRET_ADMIN_KEY_123';

            if (!adminSecretKey || adminSecretKey !== SYSTEM_ADMIN_SECRET) {
                req.flash('error_msg', 'Invalid Admin Security Key. Access denied.');
                return res.redirect('/auth/register');
            }
            selectedRole = 'admin';
        } else if (role === 'company') {
            selectedRole = 'company';
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;
        const lastOtpSentAt = Date.now();

        console.log(`--> Dispatching OTP (${otp}) via Nodemailer to ${normalizedEmail}...`);
        await sendOTPEmail(normalizedEmail, otp);
        console.log('--> Email sent successfully!');

        const userData = {
            name: (name || '').trim(),
            email: normalizedEmail,
            password,
            role: selectedRole,
            isEmailVerified: false,
            otp,
            otpExpires,
            lastOtpSentAt
        };

        if (userData.role === 'company') {
            userData.companyDetails = { companyName, cin, industry };
        }

        const newUser = await User.create(userData);

        // Company owners need companyId set to their own _id
        // so requireCompanyRole middleware allows access
        if (newUser.role === 'company') {
            newUser.companyId = newUser._id;
            await newUser.save();
        }

        console.log('--> User account created in MongoDB.');

        req.flash('success_msg', 'Verification code sent to your email!');
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err) {
        console.error('--> REGISTRATION / EMAIL ERROR:', err);
        req.flash('error_msg', "We couldn't send your verification code. Please try again in a moment.");
        res.redirect('/auth/register');
    }
});

router.get('/verify-otp', (req, res) => {
    const email = (req.query.email || '').trim().toLowerCase();
    res.render('extras/verify-otp', { email });
});

router.post('/verify-otp', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();

    try {
        console.log(`Verifying OTP for ${email}...`);
        const user = await User.findOne({ email });

        if (!user || user.otp !== otp || !user.otpExpires || user.otpExpires < Date.now()) {
            req.flash('error_msg', 'Invalid or expired OTP code.');
            return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
        }

        user.isEmailVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        user.lastOtpSentAt = undefined;
        await user.save();

        console.log(`User ${email} verified successfully.`);
        req.flash('success_msg', 'Account verified successfully! You can now log in.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error('Verification error:', err);
        req.flash('error_msg', 'Something went wrong during verification.');
        res.redirect('/auth/login');
    }
});

router.post('/resend-otp', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();

    try {
        if (!email) {
            req.flash('error_msg', 'Email address is required to resend OTP.');
            return res.redirect('/auth/register');
        }

        const user = await User.findOne({ email });

        if (!user) {
            req.flash('error_msg', 'User not found. Please register first.');
            return res.redirect('/auth/register');
        }

        if (user.isEmailVerified) {
            req.flash('error_msg', 'Account is already verified. Please log in.');
            return res.redirect('/auth/login');
        }

        // Enforce 60-second cooldown server-side to prevent spam/abuse
        const COOLDOWN_SECONDS = 60;
        const now = Date.now();
        if (user.lastOtpSentAt) {
            const elapsedSeconds = Math.floor((now - new Date(user.lastOtpSentAt).getTime()) / 1000);
            if (elapsedSeconds < COOLDOWN_SECONDS) {
                const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;
                req.flash('error_msg', `Please wait ${remainingSeconds}s before requesting a new code.`);
                return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
            }
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = now + 10 * 60 * 1000;
        user.lastOtpSentAt = now;

        await sendOTPEmail(email, otp);
        await user.save();

        req.flash('success_msg', 'A new verification code has been sent to your email.');
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
        console.error('Resend OTP error:', err);
        req.flash('error_msg', "We couldn't send your code. Please try again in a moment.");
        res.redirect(`/auth/verify-otp?email=${encodeURIComponent(email)}`);
    }
});

router.post('/login', (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error_msg', info ? info.message : 'Invalid email or password.');
            return res.redirect('/auth/login');
        }

        if (!user.isEmailVerified) {
            req.flash('error_msg', 'Please verify your email via OTP before logging in.');
            return res.redirect(`/auth/verify-otp?email=${encodeURIComponent(user.email)}`);
        }

        req.logIn(user, (err) => {
            if (err) return next(err);

            req.flash('success_msg', `Welcome back, ${user.name}!`);

            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else if (user.role === 'company' || user.role === 'recruiter') {
                return res.redirect('/company/dashboard');
            } else {
                return res.redirect('/');
            }
        });
    })(req, res, next);
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user) => {
        if (err || !user) return res.redirect('/auth/login');

        if (!user.isEmailVerified) {
            user.isEmailVerified = true;
            user.save().catch(console.error);
        }

        req.logIn(user, (err) => {
            if (err) return next(err);
            req.flash('success_msg', `Welcome back, ${user.name}!`);

            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            } else if (user.role === 'company' || user.role === 'recruiter') {
                return res.redirect('/company/dashboard');
            } else {
                return res.redirect('/');
            }
        });
    })(req, res, next);
});

router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash('success_msg', 'Logged out successfully.');
        res.redirect('/auth/login');
    });
});

module.exports = router;