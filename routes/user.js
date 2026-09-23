const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const pdfParseModule = require('pdf-parse');
const mammoth = require('mammoth');

const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { isAuthenticated, authorize } = require('../middleware/auth');
const { documentUpload, uploadBufferToCloudinary } = require('../middleware/upload');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

function calculateSkillScore(userSkills = [], requiredSkills = []) {
    if (!requiredSkills || !requiredSkills.length) return 100;
    if (!userSkills || !userSkills.length) return 0;
    const userSkillsLower = userSkills.filter(Boolean).map(s => String(s).trim().toLowerCase());
    let matchCount = 0;
    requiredSkills.filter(Boolean).forEach(skill => {
        if (userSkillsLower.includes(String(skill).trim().toLowerCase())) matchCount++;
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

        let district = '';
        let state = '';
        if (location) {
            const parts = location.split(',').map(s => s.trim());
            district = parts[0] || '';
            state = parts[1] || '';
        }

        await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    age: age ? Number(age) : null,
                    familyIncome: familyIncome ? Number(familyIncome) : null,
                    institution: institution || '',
                    'education.institutionName': institution || '',
                    skills: skillsArray,
                    'location.district': district,
                    'location.state': state,
                    'education.qualification': qualification || ''
                }
            },
            { new: true, runValidators: false }
        );

        if (req.flash) req.flash('success_msg', 'Profile updated successfully!');
        res.redirect('/candidate/profile');
    } catch (error) {
        console.error('Error updating candidate profile:', error);
        if (req.flash) req.flash('error_msg', 'Failed to update profile. Please try again.');
        res.redirect('/candidate/profile');
    }
});

router.post('/candidate/parse-resume', isAuthenticated, authorize('candidate'), (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (err) {
            if (req.flash) req.flash('error_msg', err.message || 'File upload failed. Only PDF and Word files under 5MB are accepted.');
            return res.redirect('/candidate/profile');
        }
        next();
    });
}, async (req, res) => {
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
            $set: { resume: resumeUrl }
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

function handleDocumentUpload(fieldName) {
    return (req, res, next) => {
        documentUpload.single(fieldName)(req, res, (err) => {
            if (err) {
                const message = err.code === 'LIMIT_FILE_SIZE'
                    ? 'File is too large. Maximum allowed size is 5MB.'
                    : (err.message || 'File upload failed.');
                if (req.flash) req.flash('error_msg', message);
                return res.redirect('/candidate/profile');
            }
            next();
        });
    };
}

function sanitizeLink(value) {
    const link = (value || '').trim();
    if (!link) return { link: '' };

    try {
        const parsed = new URL(link);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return { error: 'Links must start with http:// or https://' };
        }
        return { link: parsed.toString() };
    } catch {
        return { error: 'Please enter a valid URL (e.g. https://example.com/certificate).' };
    }
}

function sanitizeIssueDate(value) {
    const raw = (value || '').trim();
    if (!raw) return { issueDate: null };

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return { error: 'Please enter a valid issue date.' };
    }
    if (parsed > new Date()) {
        return { error: 'Issue date cannot be in the future.' };
    }
    return { issueDate: parsed };
}

function parseTechStack(value) {
    return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 20);
}

async function storeDocument(file, folder) {
    if (!file) return null;
    const result = await uploadBufferToCloudinary(file, folder);
    return { fileUrl: result.secure_url, fileName: file.originalname };
}

function redirectWithError(req, res, message) {
    if (req.flash) req.flash('error_msg', message);
    return res.redirect('/candidate/profile');
}


router.post('/candidate/profile/certifications', isAuthenticated, authorize('candidate'),
    handleDocumentUpload('certificate'), async (req, res) => {
        try {
            const name = (req.body.name || '').trim();
            if (!name) return redirectWithError(req, res, 'Certification name is required.');
            if (name.length > 120) return redirectWithError(req, res, 'Certification name must be 120 characters or fewer.');

            const { link, error: linkError } = sanitizeLink(req.body.link);
            if (linkError) return redirectWithError(req, res, linkError);

            const { issueDate, error: dateError } = sanitizeIssueDate(req.body.issueDate);
            if (dateError) return redirectWithError(req, res, dateError);

            const certification = {
                name,
                issuer: (req.body.issuer || '').trim().slice(0, 120),
                link,
                issueDate: issueDate || undefined
            };

            const stored = await storeDocument(req.file, 'internpilot/certifications');
            if (stored) Object.assign(certification, stored);

            const userId = req.user._id || req.user.id;
            await User.findByIdAndUpdate(userId, { $push: { certifications: certification } });

            if (req.flash) req.flash('success_msg', 'Certification added successfully!');
            res.redirect('/candidate/profile');
        } catch (error) {
            console.error('Error adding certification:', error);
            redirectWithError(req, res, 'Failed to add certification. Please try again.');
        }
    });

router.put('/candidate/profile/certifications/:certId', isAuthenticated, authorize('candidate'),
    handleDocumentUpload('certificate'), async (req, res) => {
        try {
            const userId = req.user._id || req.user.id;
            const user = await User.findById(userId);
            const certification = user && user.certifications.id(req.params.certId);
            if (!certification) return redirectWithError(req, res, 'Certification not found.');

            const name = (req.body.name || '').trim();
            if (!name) return redirectWithError(req, res, 'Certification name is required.');
            if (name.length > 120) return redirectWithError(req, res, 'Certification name must be 120 characters or fewer.');

            const { link, error: linkError } = sanitizeLink(req.body.link);
            if (linkError) return redirectWithError(req, res, linkError);

            const { issueDate, error: dateError } = sanitizeIssueDate(req.body.issueDate);
            if (dateError) return redirectWithError(req, res, dateError);

            certification.name = name;
            certification.issuer = (req.body.issuer || '').trim().slice(0, 120);
            certification.link = link;
            certification.issueDate = issueDate || undefined;

            const stored = await storeDocument(req.file, 'internpilot/certifications');
            if (stored) {
                certification.fileUrl = stored.fileUrl;
                certification.fileName = stored.fileName;
            }

            await user.save();
            if (req.flash) req.flash('success_msg', 'Certification updated successfully!');
            res.redirect('/candidate/profile');
        } catch (error) {
            console.error('Error updating certification:', error);
            redirectWithError(req, res, 'Failed to update certification. Please try again.');
        }
    });

router.delete('/candidate/profile/certifications/:certId', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId).select('certifications');
        if (!user || !user.certifications.id(req.params.certId)) {
            return redirectWithError(req, res, 'Certification not found.');
        }

        await User.findByIdAndUpdate(userId, { $pull: { certifications: { _id: req.params.certId } } });

        if (req.flash) req.flash('success_msg', 'Certification removed.');
        res.redirect('/candidate/profile');
    } catch (error) {
        console.error('Error deleting certification:', error);
        redirectWithError(req, res, 'Failed to remove certification. Please try again.');
    }
});


router.post('/candidate/profile/projects', isAuthenticated, authorize('candidate'),
    handleDocumentUpload('attachment'), async (req, res) => {
        try {
            const title = (req.body.title || '').trim();
            if (!title) return redirectWithError(req, res, 'Project title is required.');
            if (title.length > 120) return redirectWithError(req, res, 'Project title must be 120 characters or fewer.');

            const { link, error: linkError } = sanitizeLink(req.body.link);
            if (linkError) return redirectWithError(req, res, linkError);

            const project = {
                title,
                description: (req.body.description || '').trim().slice(0, 1000),
                link,
                techStack: parseTechStack(req.body.techStack)
            };

            const stored = await storeDocument(req.file, 'internpilot/projects');
            if (stored) Object.assign(project, stored);

            const userId = req.user._id || req.user.id;
            await User.findByIdAndUpdate(userId, { $push: { projects: project } });

            if (req.flash) req.flash('success_msg', 'Project added successfully!');
            res.redirect('/candidate/profile');
        } catch (error) {
            console.error('Error adding project:', error);
            redirectWithError(req, res, 'Failed to add project. Please try again.');
        }
    });

router.put('/candidate/profile/projects/:projectId', isAuthenticated, authorize('candidate'),
    handleDocumentUpload('attachment'), async (req, res) => {
        try {
            const userId = req.user._id || req.user.id;
            const user = await User.findById(userId);
            const project = user && user.projects.id(req.params.projectId);
            if (!project) return redirectWithError(req, res, 'Project not found.');

            const title = (req.body.title || '').trim();
            if (!title) return redirectWithError(req, res, 'Project title is required.');
            if (title.length > 120) return redirectWithError(req, res, 'Project title must be 120 characters or fewer.');

            const { link, error: linkError } = sanitizeLink(req.body.link);
            if (linkError) return redirectWithError(req, res, linkError);

            project.title = title;
            project.description = (req.body.description || '').trim().slice(0, 1000);
            project.link = link;
            project.techStack = parseTechStack(req.body.techStack);

            const stored = await storeDocument(req.file, 'internpilot/projects');
            if (stored) {
                project.fileUrl = stored.fileUrl;
                project.fileName = stored.fileName;
            }

            await user.save();
            if (req.flash) req.flash('success_msg', 'Project updated successfully!');
            res.redirect('/candidate/profile');
        } catch (error) {
            console.error('Error updating project:', error);
            redirectWithError(req, res, 'Failed to update project. Please try again.');
        }
    });

router.delete('/candidate/profile/projects/:projectId', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const user = await User.findById(userId).select('projects');
        if (!user || !user.projects.id(req.params.projectId)) {
            return redirectWithError(req, res, 'Project not found.');
        }

        await User.findByIdAndUpdate(userId, { $pull: { projects: { _id: req.params.projectId } } });

        if (req.flash) req.flash('success_msg', 'Project removed.');
        res.redirect('/candidate/profile');
    } catch (error) {
        console.error('Error deleting project:', error);
        redirectWithError(req, res, 'Failed to remove project. Please try again.');
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

        // IDOR Protection: Candidates can only access their own recommendations (Admins can view any)
        if (req.user._id.toString() !== userId && req.user.role !== 'admin') {
            if (req.flash) req.flash('error_msg', 'You are not authorized to view recommendations for other candidates.');
            return res.redirect(`/recommendations/${req.user._id}`);
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('Candidate profile not found.');
        }

        const isAgeValid = user.age >= 21 && user.age <= 24;
        const isIncomeValid = user.familyIncome !== undefined && user.familyIncome !== null && user.familyIncome <= 800000;
        const isEligible = isAgeValid && isIncomeValid;

        const reasons = [];
        if (!isAgeValid) reasons.push(`Age (${user.age || 'N/A'}) falls outside the 21–24 permitted range.`);
        if (!isIncomeValid) reasons.push(`Family income (${user.familyIncome ? '₹' + user.familyIncome.toLocaleString('en-IN') : 'N/A'}) exceeds the ₹8,00,000 ceiling.`);

        const eligibility = { isEligible, reasons };

        const userDistrict = user.location?.district ? user.location.district.trim() : '';
        const userQualification = user.education?.qualification ? user.education.qualification.trim() : '';

        let internships = [];
        const queryConditions = [];
        if (userDistrict) {
            queryConditions.push({ 'location.district': new RegExp(`^${escapeRegExp(userDistrict)}$`, 'i') });
        }
        if (userQualification) {
            queryConditions.push({
                $or: [
                    { minQualifications: new RegExp(`^${escapeRegExp(userQualification)}$`, 'i') },
                    { minQualification: new RegExp(`^${escapeRegExp(userQualification)}$`, 'i') }
                ]
            });
        }

        if (queryConditions.length > 0) {
            internships = await Internship.find({ $or: queryConditions });
        }

        // If no match by district/qualification or not set, fall back to open internships
        if (!internships || internships.length === 0) {
            internships = await Internship.find({}).limit(20);
        }

        const recommendations = internships
            .map((role) => ({
                role,
                matchScore: calculateSkillScore(user.skills, role.requiredSkills)
            }))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 6);

        // Fetch already applied IDs
        const apps = await Application.find({ candidate: user._id }).select('internship');
        const appliedIds = apps.map(a => a.internship ? a.internship.toString() : null).filter(Boolean);

        res.render('candidate/candidate-recommendations', { user, eligibility, recommendations, appliedIds });
    } catch (error) {
        console.error('Error fetching recommendation dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;