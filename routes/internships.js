const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { isAuthenticated, authorize, requireCompanyRole } = require('../middleware/auth');

function calculateSkillScore(userSkills = [], requiredSkills = []) {
    if (!requiredSkills.length) return 100;
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    let matchCount = 0;
    requiredSkills.forEach(skill => {
        if (userSkillsLower.includes(skill.toLowerCase())) matchCount++;
    });
    return Math.round((matchCount / requiredSkills.length) * 100);
}

router.get('/', async (req, res) => {
    try {
        const internships = await Internship.find({}).sort({ _id: -1 });
        const candidate = req.user;

        let appliedIds = [];
        if (candidate) {
            const apps = await Application.find({ candidate: candidate._id }).select('internship');
            appliedIds = apps.map(appDoc => appDoc.internship.toString());
        }

        res.render('extras/internships', { internships, candidate, appliedIds });
    } catch (error) {
        console.error('Error fetching internships:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/new', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { title, company: companyName, location, sector, stipend, vacancies, requiredSkills } = req.body;

        const locationParts = location ? location.split(',') : [];
        const district = locationParts[0] ? locationParts[0].trim() : '';
        const state = locationParts[1] ? locationParts[1].trim() : '';
        const stipendNumber = stipend ? parseInt(stipend.toString().replace(/[^0-9]/g, '')) : 5000;

        const newInternship = new Internship({
            title,
            companyName: companyName || req.user.companyDetails?.companyName || req.user.name,
            companyId: req.user.companyId,
            sector,
            location: { district, state },
            monthlyStipend: stipendNumber,
            vacancies: vacancies ? parseInt(vacancies) : 1,
            requiredSkills: requiredSkills ? requiredSkills.split(',').map(s => s.trim()) : [],
            postedBy: req.user._id
        });

        await newInternship.save();
        if (req.flash) req.flash('success_msg', 'Internship opportunity posted!');
        res.redirect('/internships');
    } catch (error) {
        console.error('Error saving internship:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/:id/edit', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) {
            if (req.flash) req.flash('error_msg', 'Unauthorized action or internship not found.');
            return res.redirect('/internships');
        }

        const { title, company: companyName, location, sector, stipend, duration, vacancies, requiredSkills } = req.body;

        const locationParts = location ? location.split(',') : [];
        const district = locationParts[0] ? locationParts[0].trim() : '';
        const state = locationParts[1] ? locationParts[1].trim() : '';
        const stipendNumber = stipend ? parseInt(stipend.toString().replace(/[^0-9]/g, '')) : 5000;

        internship.title = title || internship.title;
        if (companyName) internship.companyName = companyName;
        internship.sector = sector || internship.sector;
        internship.location = { district, state };
        internship.monthlyStipend = stipendNumber;
        internship.duration = duration || '12 Months';
        internship.vacancies = parseInt(vacancies) || 1;
        internship.requiredSkills = requiredSkills ? requiredSkills.split(',').map(s => s.trim()) : [];
        await internship.save();

        if (req.flash) req.flash('success_msg', 'Internship updated successfully.');
        res.redirect('/internships');
    } catch (error) {
        console.error('Error updating internship:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/:id/delete', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) {
            if (req.flash) req.flash('error_msg', 'Unauthorized action or internship not found.');
            return res.redirect('/internships');
        }

        if (req.flash) req.flash('success_msg', 'Internship removed.');
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
            .sort({ matchScore: -1 });

        res.render('company/company-applicants', { internship, applications, user: req.user });
    } catch (error) {
        console.error('Error fetching applicants:', error);
        res.status(500).send('Database Error');
    }
});

module.exports = router;
