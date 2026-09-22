const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Internship = require('../models/Internship');
const { isAuthenticated, authorize } = require('../middleware/auth');

/**
 * Generates an AI response using the NVIDIA NIM API (OpenAI-compatible).
 * 
 * @param {string} systemPrompt 
 * @param {string} userMessage 
 * @returns {Promise<string>}
 */
const generateNvidiaReply = async (systemPrompt, userMessage) => {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        throw new Error('NVIDIA_API_KEY is not configured in environment variables.');
    }

    const model = process.env.NVIDIA_MODEL || 'meta/llama-3.2-11b-vision-instruct';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 800
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`NVIDIA API returned HTTP ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I couldn't generate a response right now. Please try again!";
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('NVIDIA API request timed out after 20 seconds.');
        }
        throw err;
    }
};

router.post('/candidate/chat-query', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ reply: "Please provide a valid message." });
        }

        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ reply: "Candidate profile not found." });
        }

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

        const reply = await generateNvidiaReply(systemPrompt, message.trim());
        res.json({ reply });

    } catch (error) {
        console.error('NVIDIA Chat Assistant Error:', error.message || error);
        res.status(500).json({ reply: 'Sorry, I encountered an error communicating with the AI assistant. Please try again in a moment.' });
    }
});

module.exports = router;