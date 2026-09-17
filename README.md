🚀 InternPilot

<p align="center">
  <b>An AI-Powered Full-Stack Internship Management & Recruitment Portal</b>
</p>

<p align="center">
  Connecting students, companies, and administrators through a secure and efficient internship ecosystem.
</p>


<p align="center">
![Node.js](https://img.shields.io/badge/Node.js-v16%2B-green?logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-Backend-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green?logo=mongodb)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-blue?logo=tailwindcss)
</p>


📌 About The Project

InternPilot is an AI - powered full-stack internship management web portal designed to connect students/candidates with companies offering internship opportunities while providing administrators with complete system control.

The platform provides a structured environment where:

🎓 Candidates can register, discover internship opportunities, apply, and track application progress.

🏢 Companies can create verified profiles, publish internship listings, and manage applicants.

🛡️ Administrators can monitor and manage platform activities securely.

InternPilot focuses on providing a secure authentication system, automated communication, and role-based access control to create a seamless internship experience.

This project was developed as part of Project Based Learning - 1.

✨ Features

👥 Multi-Role Registration System

InternPilot supports three different user roles:

🎓 Candidates

Create candidate accounts.

Verify email through OTP.

Login securely.

Apply for internships.

Receive application status updates.

🏢 Companies

Companies can register by providing:

Company Name

CIN Number

Industry Details

Company Information

Companies can:

Manage their profile.

Publish internship opportunities.

Review candidate applications.

🛡️ Administrators

Admin registration is protected using a secure:

ADMIN_SECRET

Administrators have access to system-level management features.

🔐 Authentication & Security

📩 OTP Email Verification

InternPilot implements secure email verification using dynamic OTP generation.

Features:

🔢 6-digit OTP generation.

⏳ OTP expiration after 10 minutes.

🔄 Resend OTP functionality.

📧 Email delivery using Nodemailer and Gmail SMTP.

🔵 Google OAuth 2.0

Users can authenticate using Google Single Sign-On.

Benefits:

One-click registration.

Secure OAuth authentication.

Automatic email verification.

Passport.js integration.

🔑 Role-Based Authentication

InternPilot uses role-based routing to provide different experiences for each user.

After successful authentication:

Role

Dashboard

Admin

/admin/dashboard

Company

/company/dashboard

Candidate

/

Users must complete email verification before accessing the platform.

📧 Application Status Notification System

InternPilot includes an automated email notification service.

Candidates receive emails whenever their application status changes:

Status

Description

📤 Submitted

Application successfully submitted

🔍 Under Review

Company is reviewing application

⭐ Shortlisted

Candidate selected for next step

❌ Rejected

Application not selected

Powered by:

Nodemailer

Gmail SMTP

🎨 Dynamic User Interface

The frontend provides a responsive and interactive experience.

Implemented features:

Server-side rendering using EJS.

Reusable layouts using ejs-mate.

Tailwind CSS styling.

Dynamic registration forms.

Role-based input field toggling using JavaScript.

🛠️ Tech Stack

Backend

Technology

Purpose

Node.js

Runtime environment

Express.js

Backend framework

MongoDB

Database

Mongoose

MongoDB ODM

Authentication

Technology

Purpose

Passport.js

Authentication middleware

Passport Local Strategy

Email/password login

Passport Google OAuth 2.0

Google authentication

Express Session

Session management

Connect Flash

Flash messages

Frontend

Technology

Purpose

EJS

Server-side templates

ejs-mate

Layout management

Tailwind CSS

UI styling

JavaScript

Client-side interactions

Utilities

Technology

Purpose

Nodemailer

Email services

dotenv

Environment variables

📁 Directory Structure

InternPilot/
│
├── models/
│   └── User.js
│       └── User schema for Candidates, Companies & Admins
│
├── routes/
│   │
│   ├── auth.js
│   │   └── Registration, Login, OTP, Google OAuth routes
│   │
│   ├── company.js
│   │   └── Company dashboard and internship management
│   │
│   └── admin.js
│       └── Admin dashboard routes
│
├── utils/
│   │
│   └── sendEmail.js
│       └── Nodemailer email service
│
├── views/
│   │
│   ├── auth/
│   │   ├── register.ejs
│   │   └── login.ejs
│   │
│   ├── extras/
│   │   └── verify-otp.ejs
│   │
│   └── layouts/
│       └── ejs-mate layouts
│
├── public/
│   └── Static assets
│
├── app.js
│   └── Main Express server
│
├── .env
├── package.json
└── README.md

⚙️ Environment Configuration

Create a .env file in the root directory.

# Server Configuration
PORT=8080

# MongoDB Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/internpilot

# Express Session
SESSION_SECRET=your_session_secret


# Admin Security
ADMIN_SECRET=your_admin_secret_key


# Gmail SMTP Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password


# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id

GOOGLE_CLIENT_SECRET=your_google_client_secret

GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback

🚀 Getting Started

✅ Prerequisites

Make sure you have installed:

Node.js

npm package manager

MongoDB database (Local or MongoDB Atlas)

Git

Check versions:

node -v

npm -v

📥 Installation

1. Clone Repository

git clone https://github.com/somu0571/InternPilot.git

Navigate into project directory:

cd InternPilot

2. Install Dependencies

npm install

3. Configure Environment Variables

Create .env file and add required credentials.

4. Start Application

Development mode:

npx nodemon app.js

or:

node app.js

5. Access Application

Open:

http://localhost:8080

🔌 API & Authentication Routes Overview

Authentication Routes

Method

Route

Description

GET

/register

Registration page

POST

/register

Create user account

POST

/verify-otp

Verify email OTP

POST

/resend-otp

Generate new OTP

GET

/login

Login page

POST

/login

Authenticate user

GET

/auth/google

Google OAuth login

GET

/auth/google/callback

OAuth callback

GET

/logout

Logout user

Company Routes

Method

Route

Description

GET

/company/dashboard

Company dashboard

POST

/company/internship

Create internship listing

GET

/company/applications

View applications

Admin Routes

Method

Route

Description

GET

/admin/dashboard

Admin dashboard

GET

/admin/users

Manage users

🔄 Application Flow

User Registration
        |
        ↓
Role Selection
        |
        ↓
Email OTP Verification
        |
        ↓
Account Activated
        |
        ↓
Role-Based Dashboard
        |
        ↓
Internship Management
        |
        ↓
Application Updates + Email Notifications

🔮 Future Enhancements

Planned improvements:

🤖 AI-based internship recommendation engine.

🔔 Push notifications.

👨‍💻 Developed By

Project Based Learning - 1

Team Members

👨‍💻 Somsubhra Chatterjee

👨‍💻 Avani Shrivastava

👨‍💻 Tanmoy Saha

⭐ Acknowledgement

This project represents our effort towards building a practical full-stack solution that improves internship discovery, application management, and communication between students and organizations.

⭐ If you find this project useful, consider giving it a star!

🚀 START2CODE — Git, GitHub & Open Source Bootcamp

<p align="center">
  <b>LEARN • BUILD • CONTRIBUTE</b>
</p>

InternPilot is being showcased as part of START2CODE — Git, GitHub & Open Source Bootcamp, a hands-on initiative focused on helping beginners learn Git, GitHub, open-source workflows, and collaborative software development.

📅 Event Details

🗓️ 19–20 September 2026

💻 Online Event

🎯 For Beginners

⏱️ 2-Day Hands-On Workshop

🚀 1-Week Open Source Contribution Marathon

📚 Key Topics

Git

GitHub

SSH Workflows

VS Code

Open Source Contribution

Git Workflows

Pull Requests

Real-World Project Collaboration

💡 What Happens?

Participants will get hands-on experience with:

🔧 Learning Git & GitHub from scratch.

💻 Practicing Git workflows using VS Code.

🐙 Exploring open-source projects and real-world workflows.

🤝 Contributing to real projects.

🔀 Understanding branches, commits, merges, and pull requests.

🌐 Learning how to collaborate effectively on GitHub.

🏛️ Organized & Owned By

<p align="center">
  <b>GitHub Club</b><br>
  <b>under Technova Society</b><br>
  <b>SSCSE, Sharda University</b>
</p>

START2CODE is an initiative Project of the GitHub Club under Technova Society, SSCSE, Sharda University, encouraging students to learn, build, collaborate, and contribute to real-world and open-source projects.

<p align="center">
  <b>🚀 LEARN • BUILD • CONTRIBUTE 🚀</b>
</p>

⭐ If you find InternPilot useful, consider giving the repository a star!

<p align="center">
  Made with ❤️ by the InternPilot Team
</p>
