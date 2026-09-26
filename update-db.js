const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const resumeText = `ARIN MEHTA
Software Engineer | Full-Stack Web Developer
Noida, Uttar Pradesh, India | demo.candidate@example.com | +91 90000 00001 | github.com/arin-demo
PROFESSIONAL SUMMARY
Software engineering candidate with hands-on experience building production-style web applications using React, Node.js, Express, MongoDB, Redis, and WebSockets.
EXPERIENCE
Software Engineering Intern - NovaStack Labs (Fictional) | Jun 2025 - Aug 2026
Built React + Node.js dashboard features used by 1,200+ internal test users; reduced median page load time by 32% through query optimization and client-side caching.
Implemented Redis-backed caching for frequently requested API responses and designed cache invalidation around profile and application events.
Developed WebSocket-based real-time notifications with reconnect handling and heartbeat checks for intermittent network conditions.
Added JWT authentication, role-aware route guards, request validation, and structured error handling across Express APIs.
PROJECTS
Realtime Study Chat - React, Node.js, Express, WebSockets, Redis, MongoDB
Built a real-time messaging application with room-based conversations, typing indicators, online presence, and message delivery acknowledgements.
Used Redis pub/sub to coordinate WebSocket events across multiple application instances during load testing.
Added rate limiting and message validation to reduce abuse and malformed payloads.
Internship Matchboard - React, Tailwind CSS, Node.js, MongoDB, REST APIs
Created a student internship discovery platform with search, filtering, saved opportunities, and application tracking.
Implemented weighted matching across skills, qualification, location, and preferred domain; exposed match explanations alongside scores.
Designed recruiter and candidate views with company-scoped authorization and responsive mobile layouts.
EventPulse Analytics - Node.js, MongoDB, Redis, Chart.js
Built an analytics dashboard for event traffic with hourly aggregation, top-page analysis, and anomaly thresholds.
Improved repeated dashboard queries using Redis caching with short TTLs and explicit invalidation after event ingestion.
SKILLS
Languages: JavaScript, TypeScript, Python, SQL
Frontend: React, HTML5, CSS3, Tailwind CSS, responsive UI
Backend: Node.js, Express, REST APIs, WebSockets, authentication
Data & Infra: MongoDB, Redis, indexing, caching, Git, GitHub, Docker
Concepts: System design, API security, asynchronous programming, debugging, testing
EDUCATION
B.Tech in Computer Science and Engineering - Northbridge Institute of Technology (Fictional) | 2023 - 2027
Relevant coursework: Data Structures, Database Systems, Computer Networks, Operating Systems, Software Engineering.
SELECTED ACHIEVEMENTS
Built and load-tested a WebSocket prototype handling 200 simulated concurrent connections with message fan-out and reconnect recovery.
Won 2nd place in a fictional university hackathon for a campus resource-sharing platform.
Completed a 12-week system design study project focused on caching, rate limiting, database indexing, and horizontal scaling.
INTERVIEW PREPARATION PROFILE
Target roles: Frontend Engineer, Full-Stack Engineer, Backend Engineer | Preferred domains: SaaS, Developer Tools, FinTech
Focus projects for deep-dive: Realtime Study Chat, Internship Matchboard
DEMO DATA - Entire resume is fictional and intended only for testing resume parsing, mock interviews, and resume-based problem generation.`;

mongoose.connect(process.env.ATLASDB_URL).then(async () => {
    const user = await User.findOne({'resumeVersions.0': {$exists: true}});
    if (user && user.resumeVersions) {
        user.resumeVersions[user.resumeVersions.length - 1].text = resumeText;
        user.markModified('resumeVersions');
        await user.save();
        console.log('Database forcibly updated with resume text!');
    }
    process.exit(0);
});
