require('dotenv').config();
const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const sendOTPEmail = async (email, otp) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"InternPilot Support" <${process.env.EMAIL_USER}>`,
        to: email,
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

    return await transporter.sendMail(mailOptions);
};

const sendStatusUpdateEmail = async (email, candidateName, internshipTitle, status) => {
    const transporter = createTransporter();

    const statusColors = {
        'Under Review': '#d97706',
        'Shortlisted': '#059669',
        'Rejected': '#dc2626',
        'Submitted': '#4f46e5'
    };

    const color = statusColors[status] || '#4f46e5';

    const mailOptions = {
        from: `"InternPilot Support" <${process.env.EMAIL_USER}>`,
        to: email,
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

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    sendOTPEmail,
    sendStatusUpdateEmail
};