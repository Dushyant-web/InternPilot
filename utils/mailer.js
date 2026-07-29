
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

exports.sendWelcomeEmail = async (user) => {
    const isCompany = user.role === 'company';
    const subject = isCompany
        ? 'Company Portal Registration | PM Internship Scheme'
        : 'Welcome to InternPilot Portal';

    const htmlContent = isCompany ? `
        <h2>Welcome ${user.name}!</h2>
        <p>Your company <strong>${user.companyDetails?.companyName || 'organization'}</strong> is registered under the Prime Minister's Internship Scheme.</p>
        <p>You can now manage applications and post internships.</p>
    ` : `
        <h2>Welcome ${user.name}!</h2>
        <p>Your candidate registration on <strong>InternPilot</strong> was successful.</p>
        <p>Log in to complete your profile and apply for internship opportunities.</p>
    `;

    return await transporter.sendMail({
        from: `"PM Internship Scheme" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: subject,
        html: htmlContent
    });
};