require('dotenv').config();
const { sendOTPEmail } = require('./utils/sendEmail');

console.log("Testing email with user:", process.env.EMAIL_USER);

sendOTPEmail(process.env.EMAIL_USER, "123456")
    .then(() => console.log("SUCCESS: Test email sent! Check your inbox."))
    .catch((err) => console.error("EMAIL ERROR DETAILED:", err));