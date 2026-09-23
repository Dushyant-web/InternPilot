const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const pdfParseModule = require('pdf-parse');
const mammoth = require('mammoth');

const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { isAuthenticated, authorize } = require('../middleware/auth');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'application/x-pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and Word (.docx) files are allowed.'));
        }
    }
});

async function extractPdfText(buffer) {
    if (pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text || '';
    }

    const parseFn = typeof pdfParseModule === 'function'
        ? pdfParseModule
        : (pdfParseModule.default || pdfParseModule);

    const result = await parseFn(buffer);
    return result.text || '';
}

async function extractDocxText(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function analyzeResumeQuality(text) {
    try {
        const prompt = `
Analyze this resume for quality improvement.

Check specifically:
1. Quantifiable achievements and measurable outcomes.
2. Technical skills.
3. Relevant projects.

Give actionable feedback, not a numeric score.

Return ONLY valid JSON in this format:
{
  "quantifiableAchievements": {
    "status": "good" or "needs_improvement",
    "feedback": "..."
  },
  "technicalSkills": {
    "status": "good" or "needs_improvement",
    "feedback": "..."
  },
  "projects": {
    "status": "good" or "needs_improvement",
    "feedback": "..."
  },
  "overallFeedback": "..."
}

Resume text:
${text}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const rawText = response.text || '{}';
        const cleanedText = rawText.replace(/```json|```/g, '').trim();

        return JSON.parse(cleanedText);
    } catch (error) {
        console.error('Error analyzing resume quality:', error);

        return {
            quantifiableAchievements: {
                status: 'needs_improvement',
                feedback: 'Resume quality analysis was unavailable.'
            },
            technicalSkills: {
                status: 'needs_improvement',
                feedback: 'Resume quality analysis was unavailable.'
            },
            projects: {
                status: 'needs_improvement',
                feedback: 'Resume quality analysis was unavailable.'
            },
            overallFeedback: 'Resume uploaded successfully, but AI quality feedback could not be generated.'
        };
    }
}

function calculateSkillScore(userSkills = [], requiredSkills = []) {
    if (!requiredSkills || !requiredSkills.length) return 100;
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    let matchCount = 0;
    requiredSkills.forEach(skill => {
        if (userSkillsLower.includes(skill.toLowerCase())) matchCount++;
    });
    return Math.round((matchCount / requiredSkills.length) * 100);
}

router.get('/candidate/profile', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const freshUser = await User.findById(userId);

        res.render('candidate/candidate-profile', {
            user: freshUser,
            candidate: freshUser
        });
    } catch (error) {
        console.error('Error fetching candidate profile:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/candidate/profile/edit', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const { location, age, familyIncome, qualification, institution, skills } = req.body;

        const skillsArray = skills
            ? skills.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        const userId = req.user._id || req.user.id;

        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    age: age ? Number(age) : null,
                    familyIncome: familyIncome ? Number(familyIncome) : null,
                    institution: institution || '',
                    skills: skillsArray,
                    'location.district': location || '',
                    'education.qualification': qualification || ''
                }
            },
            { new: true, runValidators: false }
        );

        res.redirect('/candidate/profile');
    } catch (error) {
        console.error('Error updating candidate profile:', error);
        res.redirect('/candidate/profile');
    }
});

router.post('/candidate/parse-resume', isAuthenticated, authorize('candidate'), upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            if (req.flash) req.flash('error_msg', 'Please upload a valid PDF or Word resume.');
            return res.redirect('/candidate/profile');
        }

        const uploadToCloudinary = (file) => {
            return new Promise((resolve, reject) => {
                const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
                const publicId = `internpilot/resumes/${Date.now()}_${safeName}`;

                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        public_id: publicId,
                        resource_type: 'raw'
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(file.buffer);
            });
        };

        const cloudinaryResult = await uploadToCloudinary(req.file);
        const resumeUrl = cloudinaryResult.secure_url;

        let text = '';
        if (req.file.mimetype === 'application/pdf' || req.file.mimetype === 'application/x-pdf') {
            text = await extractPdfText(req.file.buffer);
        } else {
            text = await extractDocxText(req.file.buffer);
        }

        const skillBank = [
            'JavaScript', 'Node.js', 'Express', 'React', 'Vue', 'Angular', 'HTML', 'CSS', 'Tailwind',
            'Python', 'Java', 'C++', 'C#', 'SQL', 'MongoDB', 'PostgreSQL', 'Git', 'Docker',
            'Communication', 'Problem Solving', 'Data Analysis', 'Machine Learning', 'Excel'
        ];

        const extractedSkills = skillBank.filter(skill => {
            const escaped = escapeRegExp(skill);
            const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i');
            return regex.test(text);
        });

        let extractedQualification = '';
        if (/B\.?Tech|Bachelor of Technology/i.test(text)) extractedQualification = 'B.Tech';
        else if (/M\.?Tech|Master of Technology/i.test(text)) extractedQualification = 'M.Tech';
        else if (/B\.?Sc|Bachelor of Science/i.test(text)) extractedQualification = 'B.Sc';
        else if (/BCA|Bachelor of Computer Applications/i.test(text)) extractedQualification = 'BCA';
        else if (/MCA|Master of Computer Applications/i.test(text)) extractedQualification = 'MCA';

        const userId = req.user._id || req.user.id;
        const updateDoc = {
            $set: {
                resume: resumeUrl,
                resumeQuality
            }
        };

        if (extractedSkills.length > 0) {
            updateDoc.$addToSet = { skills: { $each: extractedSkills } };
        }
        if (extractedQualification) {
            updateDoc.$set['education.qualification'] = extractedQualification;
        }

        await User.findByIdAndUpdate(userId, updateDoc);
        if (req.flash) req.flash('success_msg', 'Resume uploaded and parsed successfully!');

        res.redirect('/candidate/profile');
    } catch (error) {
        console.error('Error uploading/parsing resume:', error);
        if (req.flash) req.flash('error_msg', `Failed to process resume upload: ${error.message}`);
        res.redirect('/candidate/profile');
    }
});

router.get('/candidate/applications', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const candidate = await User.findById(userId);
        const applications = await Application.find({ candidate: userId })
            .populate('internship');

        res.render('candidate/candidate-tracker', { candidate, applications });
    } catch (error) {
        console.error('Error fetching tracker data:', error);
        res.status(500).send('Database Error');
    }
});

router.get('/recommendations/:userId', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('Candidate profile not found.');
        }

        const isAgeValid = user.age >= 21 && user.age <= 24;
        const isIncomeValid = user.familyIncome <= 800000;
        const isEligible = isAgeValid && isIncomeValid;

        const reasons = [];
        if (!isAgeValid) reasons.push(`Age (${user.age || 'N/A'}) falls outside the 21–24 permitted range.`);
        if (!isIncomeValid) reasons.push(`Family income (₹${user.familyIncome ? user.familyIncome.toLocaleString('en-IN') : 'N/A'}) exceeds the ₹8,00,000 ceiling.`);

        const eligibility = { isEligible, reasons };

        const userDistrict = user.location ? user.location.district : '';
        const userQualification = user.education ? user.education.qualification : '';

        const internships = await Internship.find({
            $or: [
                { 'location.district': new RegExp(`^${userDistrict}$`, 'i') },
                { minQualification: new RegExp(`^${userQualification}$`, 'i') }
            ]
        });

        const recommendations = internships
            .map((role) => ({
                role,
                matchScore: calculateSkillScore(user.skills, role.requiredSkills)
            }))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 6);

        res.render('extras/index', { user, eligibility, recommendations });
    } catch (error) {
        console.error('Error fetching recommendation dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;