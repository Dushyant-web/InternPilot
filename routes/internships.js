const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { isAuthenticated, authorize, requireCompanyRole } = require('../middleware/auth');

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

router.get('/', async (req, res) => {
    try {
        const internships = await Internship.find({ status: { $ne: 'draft' } }).sort({ _id: -1 });
        const candidate = req.user;

        let appliedIds = [];
        if (candidate) {
            const apps = await Application.find({ candidate: candidate._id }).select('internship');
            appliedIds = apps.map(appDoc => appDoc.internship ? appDoc.internship.toString() : null).filter(Boolean);
        }

        res.render('extras/internships', { internships, candidate, appliedIds });
    } catch (error) {
        console.error('Error fetching internships:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/new', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { action, title, company: companyName, location, sector, stipend, vacancies, duration, requiredSkills, minQualifications } = req.body;
        const isDraft = action === 'draft' || req.body.status === 'draft';
        const status = isDraft ? 'draft' : 'published';

        const trimmedTitle = title && typeof title === 'string' ? title.trim() : '';
        if (!isDraft && !trimmedTitle) {
            if (req.flash) req.flash('error_msg', 'Internship title is required to publish.');
            return res.redirect('/internships');
        }

        const resolvedTitle = trimmedTitle || (isDraft ? 'Untitled Draft' : 'Internship Opportunity');

        const locationParts = location ? location.split(',') : [];
        const district = locationParts[0] ? locationParts[0].trim() : '';
        const state = locationParts[1] ? locationParts[1].trim() : '';
        const stipendNumber = stipend ? parseInt(stipend.toString().replace(/[^0-9]/g, '')) : (isDraft ? 0 : 5000);

        let resolvedCompanyName = companyName || req.user.companyDetails?.companyName;
        if (!resolvedCompanyName && req.user.companyId) {
            const accountOwner = await User.findById(req.user.companyId);
            resolvedCompanyName = accountOwner?.companyDetails?.companyName || accountOwner?.name;
        }
        resolvedCompanyName = resolvedCompanyName || req.user.name;

        const newInternship = new Internship({
            title: resolvedTitle,
            status,
            companyName: resolvedCompanyName,
            companyId: req.user.companyId,
            sector: sector || (isDraft ? 'Uncategorized' : 'General'),
            minQualifications: minQualifications || (isDraft ? '' : 'Any'),
            duration: duration || (isDraft ? '' : '12 Months'),
            location: { district, state },
            monthlyStipend: stipendNumber,
            vacancies: vacancies ? parseInt(vacancies) : 1,
            requiredSkills: requiredSkills ? requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
            postedBy: req.user._id
        });

        await newInternship.save();
        if (req.flash) {
            if (isDraft) {
                req.flash('success_msg', 'Draft saved successfully!');
                return res.redirect('/company/dashboard');
            } else {
                req.flash('success_msg', 'Internship opportunity posted!');
            }
        }
        res.redirect('/internships');
    } catch (error) {
        console.error('Error saving internship:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const isCompanyUser = ['company', 'recruiter'].includes(req.user.role);

        if (!isAdmin && !isCompanyUser) {
            if (req.flash) req.flash('error_msg', 'Unauthorized to edit internships.');
            return res.redirect('/internships');
        }

        const query = { _id: req.params.id };
        if (!isAdmin) {
            if (!req.user.companyId) {
                if (req.flash) req.flash('error_msg', 'You do not belong to a valid company account.');
                return res.redirect('/internships');
            }
            query.companyId = req.user.companyId;
        }

        const internship = await Internship.findOne(query);
        if (!internship) {
            if (req.flash) req.flash('error_msg', 'Unauthorized action or internship not found.');
            return res.redirect('/internships');
        }

        const { title, company: companyName, location, sector, stipend, duration, vacancies, requiredSkills, minQualifications } = req.body;

        const locationParts = location ? location.split(',') : [];
        const district = locationParts[0] ? locationParts[0].trim() : '';
        const state = locationParts[1] ? locationParts[1].trim() : '';
        const stipendNumber = stipend ? parseInt(stipend.toString().replace(/[^0-9]/g, '')) : 5000;

        internship.title = title || internship.title;
        if (companyName) internship.companyName = companyName;
        internship.sector = sector || internship.sector;
        internship.location = { district, state };
        internship.monthlyStipend = stipendNumber;
        internship.duration = duration || internship.duration || '12 Months';
        internship.vacancies = parseInt(vacancies) || internship.vacancies || 1;
        if (minQualifications) internship.minQualifications = minQualifications;
        if (requiredSkills) internship.requiredSkills = requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
        await internship.save();

        if (req.flash) req.flash('success_msg', 'Internship updated successfully.');
        res.redirect('/internships');
    } catch (error) {
        console.error('Error updating internship:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const isCompanyUser = ['company', 'recruiter'].includes(req.user.role);

        if (!isAdmin && !isCompanyUser) {
            if (req.flash) req.flash('error_msg', 'Unauthorized to delete internships.');
            return res.redirect('/internships');
        }

        const query = { _id: req.params.id };
        if (!isAdmin) {
            if (!req.user.companyId) {
                if (req.flash) req.flash('error_msg', 'You do not belong to a valid company account.');
                return res.redirect('/internships');
            }
            query.companyId = req.user.companyId;
        }

        const internship = await Internship.findOneAndDelete(query);
        if (!internship) {
            if (req.flash) req.flash('error_msg', 'Unauthorized action or internship not found.');
            return res.redirect('/internships');
        }

        // Clean up orphaned applications for this deleted internship
        await Application.deleteMany({ internship: req.params.id });

        if (req.flash) req.flash('success_msg', 'Internship removed successfully.');
        res.redirect('/internships');
    } catch (error) {
        console.error('Error deleting internship:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/:id/apply', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const candidate = req.user;
        const internship = await Internship.findById(req.params.id);

        if (!candidate || !internship) {
            return res.status(404).send('Candidate or Internship not found');
        }

        if (internship.status === 'draft') {
            if (req.flash) req.flash('error_msg', 'This internship listing is currently a draft and not accepting applications.');
            return res.redirect('/internships');
        }

        const existingApp = await Application.findOne({
            internship: internship._id,
            candidate: candidate._id
        });

        if (existingApp) {
            if (req.flash) req.flash('error_msg', 'You have already applied for this opportunity.');
            return res.redirect('/candidate/applications');
        }

        const score = calculateSkillScore(candidate.skills || [], internship.requiredSkills || []);

        await Application.create({
            internship: internship._id,
            candidate: candidate._id,
            matchScore: score
        });

        if (req.flash) req.flash('success_msg', 'Application submitted successfully!');
        res.redirect('/candidate/applications');
    } catch (error) {
        console.error('Error applying for internship:', error);
        res.status(500).send('Database Error');
    }
});

router.get('/:id/applicants', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) {
            if (req.flash) req.flash('error_msg', 'Unauthorized action or internship not found.');
            return res.redirect('/internships');
        }

        const applications = await Application.find({ internship: req.params.id })
            .populate('candidate')
            .populate('notes.createdBy')
            .sort({ matchScore: -1 });

        res.render('company/company-applicants', { internship, applications, user: req.user });
    } catch (error) {
        console.error('Error fetching applicants:', error);
        res.status(500).send('Database Error');
    }
});

module.exports = router;
