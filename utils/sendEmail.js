require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Creates and returns a configured Nodemailer transporter.
 * Supports custom SMTP configuration with fallback to Gmail service.
 * Includes timeout settings to prevent hanging connections.
 */
const createTransporter = () => {
    const timeoutConfig = {
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 15000      // 15 seconds
    };

    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            ...timeoutConfig,
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER || process.env.EMAIL_USER,
                pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
            }
        });
    }

    return nodemailer.createTransport({
        ...timeoutConfig,
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Sends an email with retry logic and exponential backoff.
 * Logs delivery attempts, successes, and failures server-side.
 * 
 * @param {Object} mailOptions 
 * @param {number} maxRetries 
 * @returns {Promise<Object>} info
 */
const sendWithRetry = async (mailOptions, maxRetries = 3) => {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[EMAIL] [Attempt ${attempt}/${maxRetries}] Dispatching to: ${mailOptions.to} (Subject: "${mailOptions.subject}")`);
            const transporter = createTransporter();
            const info = await transporter.sendMail(mailOptions);
            console.log(`[EMAIL] SUCCESS: Email successfully delivered to ${mailOptions.to}. MessageId: ${info.messageId}`);
            return info;
        } catch (err) {
            lastError = err;
            console.error(`[EMAIL] ERROR: Attempt ${attempt}/${maxRetries} failed for ${mailOptions.to}: ${err.message}`);

            if (attempt < maxRetries) {
                const backoffDelay = attempt * 1500; // 1.5s, 3s backoff
                console.log(`[EMAIL] Retrying delivery in ${backoffDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            }
        }
    }

    console.error(`[EMAIL] CRITICAL: All ${maxRetries} delivery attempts failed for ${mailOptions.to}. Final Error: ${lastError?.message}`);
    throw lastError;
};

/**
 * Sends an OTP verification email to the user.
 * 
 * @param {string} email 
 * @param {string} otp 
 * @returns {Promise<Object>}
 */
const sendOTPEmail = async (email, otp) => {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
        throw new Error('Recipient email address is required.');
    }

    const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@internpilot.com';

    const mailOptions = {
        from: `"InternPilot Support" <${senderEmail}>`,
        to: cleanEmail,
        subject: 'Verify Your InternPilot Account - OTP Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">Welcome to InternPilot!</h2>
                <p>Please use the one-time password (OTP) below to verify your email address and complete your registration.</p>
                <div style="background: #f3f4f6; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #1e293b; border-radius: 8px; margin: 25px 0;">
                    ${otp}
                </div>
                <p>This verification code will expire in <strong>10 minutes</strong>.</p>
                <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">If you didn't request this, please ignore this email.</p>
            </div>
        `
    };

    return await sendWithRetry(mailOptions);
};

/**
 * Sends an internship application status update email to the candidate.
 * 
 * @param {string} email 
 * @param {string} candidateName 
 * @param {string} internshipTitle 
 * @param {string} status 
 * @returns {Promise<Object>}
 */
const sendStatusUpdateEmail = async (email, candidateName, internshipTitle, status) => {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
        throw new Error('Recipient email address is required.');
    }

    const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@internpilot.com';

    const statusColors = {
        'Under Review': '#d97706',
        'Shortlisted': '#059669',
        'Rejected': '#dc2626',
        'Submitted': '#4f46e5'
    };

    const color = statusColors[status] || '#4f46e5';

    const mailOptions = {
        from: `"InternPilot Support" <${senderEmail}>`,
        to: cleanEmail,
        subject: `Application Status Update - ${internshipTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">InternPilot</h2>
                <p>Hi <strong>${candidateName}</strong>,</p>
                <p>Your application status for the position <strong>${internshipTitle}</strong> has been updated to:</p>
                <div style="background: #f8fafc; padding: 15px; font-size: 20px; font-weight: bold; text-align: center; color: ${color}; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    ${status}
                </div>
                <p>Log in to your InternPilot account to view further details.</p>
                <p style="font-size: 12px; color: #64748b; margin-top: 30px; text-align: center;">Thank you for using InternPilot!</p>
            </div>
        `
    };

    return await sendWithRetry(mailOptions);
};

module.exports = {
    sendOTPEmail,
    sendStatusUpdateEmail
};