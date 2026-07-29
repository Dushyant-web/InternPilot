const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

const User = require('../models/User');
const Internship = require('../models/Internship');
const { isAuthenticated, authorize } = require('../middleware/auth');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/candidate/chat-query', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ reply: "Please provide a message." });

        const userId = req.user._id || req.user.id;

        const user = await User.findById(userId);

        const internships = await Internship.find({});


        const systemPrompt = `
You are InternPilot AI, a friendly and professional career assistant built into an internship platform.
Your job is to help candidates find and recommend internships based strictly on their profile data and the active database listings provided below.

CANDIDATE PROFILE:
- Skills: ${user.skills && user.skills.length > 0 ? user.skills.join(', ') : 'None listed yet'}
- Location/District: ${user.location?.district || 'Not specified'}
- Qualification: ${user.education?.qualification || 'Not specified'}
- Age: ${user.age || 'Not specified'}
- Family Income: ₹${user.familyIncome ? user.familyIncome.toLocaleString('en-IN') : 'Not specified'}

ACTIVE INTERNSHIPS IN DATABASE:
${JSON.stringify(internships.map(i => ({
            id: i._id,
            title: i.title,
            company: i.company,
            location: i.location,
            requiredSkills: i.requiredSkills,
            stipend: i.stipend
        })))}

INSTRUCTIONS:
- Answer the candidate's query conversationally.
- If they ask for recommendations, evaluate their parsed skills against the active internship requirements and recommend the best matches.
- If they ask about eligibility, check their age (21-24) and family income (<= 8 Lakhs).
- Keep responses clean, encouraging, and formatted using Markdown bullet points if listing jobs.
`;


        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }, { text: `Candidate Message: ${message}` }] }
            ]
        });

        const reply = response.text || "I couldn't generate a response right now. Please try again!";
        res.json({ reply });

    } catch (error) {
        console.error('Gemini Chat Error:', error);
        res.status(500).json({ reply: 'Sorry, I encountered an error communicating with the AI assistant.' });
    }
});

module.exports = router;