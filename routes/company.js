const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const { isAuthenticated, requireCompanyRole } = require('../middleware/auth');
const { sendStatusUpdateEmail } = require('../utils/sendEmail');

router.get('/company/dashboard', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internships = await Internship.find({ companyId: req.user.companyId }).sort({ _id: -1 });
        const internshipIds = internships.map(i => i._id);
        const totalApplicationsCount = await Application.countDocuments({ internship: { $in: internshipIds } });

        res.render('company/company-dashboard', {
            user: req.user,
            internships,
            totalApplicationsCount
        });
    } catch (error) {
        console.error('Error loading company dashboard:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/internships/create', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { title, sector, requiredSkills, minQualifications, monthlyStipend, vacancies, duration, district, state } = req.body;
        let companyName = req.user.companyDetails?.companyName;
        if (!companyName) {
             const accountOwner = await User.findById(req.user.companyId);
             companyName = accountOwner?.companyDetails?.companyName || accountOwner?.name || req.user.name;
        }

        const skillsArray = requiredSkills
            ? requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        await Internship.create({
            companyId: req.user.companyId,
            postedBy: req.user._id,
            companyName,
            title,
            sector: sector || 'General',
            minQualifications: minQualifications || 'Any',
            requiredSkills: skillsArray,
            monthlyStipend: monthlyStipend ? Number(monthlyStipend) : 5000,
            vacancies: vacancies ? Number(vacancies) : 1,
            duration: duration || '12 Months',
            location: {
                district: district || '',
                state: state || ''
            }
        });

        if (req.flash) req.flash('success_msg', 'Internship posted successfully!');
        res.redirect('/company/dashboard');
    } catch (error) {
        console.error('Error creating internship:', error);
        res.redirect('/company/dashboard');
    }
});

router.get('/company/internships/:id/applicants', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internshipId = req.params.id;

        const internship = await Internship.findById(internshipId);
        if (!internship) {
            return res.status(404).send('Internship posting not found.');
        }

        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const isAuthorizedCompany = (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName);

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to view applicants for this internship.');
            return res.redirect('/company/dashboard');
        }

        const applications = await Application.find({ internship: internshipId })
            .populate('candidate')
            .populate('notes.createdBy')
            .sort({ _id: -1 });

        res.render('company/company-applicants', {
            user: req.user,
            internship,
            applications
        });
    } catch (error) {
        console.error('Error fetching applicants:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/applications/:id/notes', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { text } = req.body;
        const applicationId = req.params.id;

        const application = await Application.findById(applicationId).populate('internship');
        if (!application) {
            return res.status(404).send('Application not found.');
        }

        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const internship = application.internship;
        const isAuthorizedCompany = internship && (
            (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName)
        );

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to manage notes for this application.');
            return res.redirect('/company/dashboard');
        }

        const internshipId = internship._id || internship;

        if (!text || !text.trim()) {
            if (req.flash) req.flash('error_msg', 'Note text cannot be empty.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        application.notes.push({
            text: text.trim(),
            createdBy: req.user._id
        });
        await application.save();

        if (req.flash) req.flash('success_msg', 'Note added successfully!');
        res.redirect(`/company/internships/${internshipId}/applicants`);
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/applications/:id/notes/:noteId/edit', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { text } = req.body;
        const { id: applicationId, noteId } = req.params;

        const application = await Application.findById(applicationId).populate('internship');
        if (!application) {
            return res.status(404).send('Application not found.');
        }

        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const internship = application.internship;
        const isAuthorizedCompany = internship && (
            (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName)
        );

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to edit notes for this application.');
            return res.redirect('/company/dashboard');
        }

        const internshipId = internship._id || internship;
        const note = application.notes.id(noteId);

        if (!note) {
            if (req.flash) req.flash('error_msg', 'Note not found.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        if (!note.createdBy || note.createdBy.toString() !== req.user._id.toString()) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to edit this note.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        if (!text || !text.trim()) {
            if (req.flash) req.flash('error_msg', 'Note text cannot be empty.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        note.text = text.trim();
        note.updatedAt = new Date();
        await application.save();

        if (req.flash) req.flash('success_msg', 'Note updated successfully!');
        res.redirect(`/company/internships/${internshipId}/applicants`);
    } catch (error) {
        console.error('Error updating note:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/applications/:id/notes/:noteId/delete', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { id: applicationId, noteId } = req.params;

        const application = await Application.findById(applicationId).populate('internship');
        if (!application) {
            return res.status(404).send('Application not found.');
        }

        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const internship = application.internship;
        const isAuthorizedCompany = internship && (
            (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName)
        );

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to delete notes for this application.');
            return res.redirect('/company/dashboard');
        }

        const internshipId = internship._id || internship;
        const note = application.notes.id(noteId);

        if (!note) {
            if (req.flash) req.flash('error_msg', 'Note not found.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        if (!note.createdBy || note.createdBy.toString() !== req.user._id.toString()) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to delete this note.');
            return res.redirect(`/company/internships/${internshipId}/applicants`);
        }

        application.notes.pull(noteId);
        await application.save();

        if (req.flash) req.flash('success_msg', 'Note deleted successfully!');
        res.redirect(`/company/internships/${internshipId}/applicants`);
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/applications/:id/status', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const { status } = req.body;
        const applicationId = req.params.id;

        const allowedStatuses = ['Submitted', 'Under Review', 'Shortlisted', 'Rejected'];
        if (!status || !allowedStatuses.includes(status)) {
            if (req.flash) req.flash('error_msg', 'Invalid application status provided.');
            return res.redirect('/company/dashboard');
        }

        const application = await Application.findById(applicationId)
            .populate('candidate')
            .populate('internship');

        if (!application || !application.internship) {
            return res.status(404).send('Application not found.');
        }

        const internship = application.internship;
        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const isAuthorizedCompany = (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName);

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'Unauthorized to modify status for this application.');
            return res.redirect('/company/dashboard');
        }

        const previousStatus = application.status;
        application.status = status;
        await application.save();

        if (previousStatus !== status && application.candidate?.email) {
            try {
                const candidateName = application.candidate.name || 'Candidate';
                const internshipTitle = application.internship?.title || 'Internship';

                await sendStatusUpdateEmail(
                    application.candidate.email,
                    candidateName,
                    internshipTitle,
                    status
                );
            } catch (emailErr) {
                console.error('Failed to send status update email:', emailErr);
            }
        }

        if (req.flash) req.flash('success_msg', `Application marked as ${status}`);
        const referrer = req.get('Referrer');
        if (referrer && referrer.includes('/company/')) {
            return res.redirect(referrer);
        }
        res.redirect(`/company/internships/${application.internship._id}/applicants`);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).send('Database Error');
    }
});

router.get('/company/internships/edit/:id', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) {
            return res.status(404).send('Internship not found or unauthorized.');
        }

        res.render('company/edit-internship', {
            user: req.user,
            internship
        });
    } catch (error) {
        console.error('Error loading edit form:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/internships/edit/:id', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) return res.status(404).send('Internship not found or unauthorized.');

        const { title, sector, requiredSkills, minQualifications, monthlyStipend, vacancies, duration, district, state } = req.body;

        const skillsArray = requiredSkills
            ? requiredSkills.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        internship.title = title;
        internship.sector = sector || 'General';
        internship.minQualifications = minQualifications || 'Any';
        internship.requiredSkills = skillsArray;
        internship.monthlyStipend = monthlyStipend ? Number(monthlyStipend) : 5000;
        internship.vacancies = vacancies ? Number(vacancies) : 1;
        internship.duration = duration || '12 Months';
        internship.location = {
            district: district || '',
            state: state || ''
        };

        await internship.save();

        if (req.flash) req.flash('success_msg', 'Internship updated successfully!');
        res.redirect('/company/dashboard');
    } catch (error) {
        console.error('Error updating internship:', error);
        res.redirect('/company/dashboard');
    }
});

router.post('/company/internships/delete/:id', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        const internship = await Internship.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (!internship) return res.status(404).send('Internship not found or unauthorized.');

        // Clean up orphaned applications for this deleted internship
        await Application.deleteMany({ internship: req.params.id });

        if (req.flash) req.flash('success_msg', 'Internship deleted successfully!');
        res.redirect('/company/dashboard');
    } catch (error) {
        console.error('Error deleting internship:', error);
        res.status(500).send('Database Error');
    }
});

// --- Team Management Routes ---

router.get('/company/team', isAuthenticated, requireCompanyRole(['company']), async (req, res) => {
    try {
        const teamMembers = await User.find({
            companyId: req.user.companyId,
            role: 'recruiter',
            isActive: true
        }).sort({ createdAt: -1 });

        res.render('company/company-team', {
            user: req.user,
            teamMembers
        });
    } catch (error) {
        console.error('Error loading team page:', error);
        res.status(500).send('Database Error');
    }
});

router.post('/company/team/add', isAuthenticated, requireCompanyRole(['company']), async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            if (req.flash) req.flash('error_msg', 'Email is already registered.');
            return res.redirect('/company/team');
        }

        await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: 'recruiter',
            companyId: req.user.companyId,
            isEmailVerified: true,
            isActive: true
        });

        if (req.flash) req.flash('success_msg', 'Recruiter added successfully!');
        res.redirect('/company/team');
    } catch (error) {
        console.error('Error adding recruiter:', error);
        if (req.flash) req.flash('error_msg', 'An error occurred while adding recruiter.');
        res.redirect('/company/team');
    }
});

router.post('/company/team/remove/:id', isAuthenticated, requireCompanyRole(['company']), async (req, res) => {
    try {
        const member = await User.findOne({ _id: req.params.id, companyId: req.user.companyId, role: 'recruiter' });
        if (!member) {
            if (req.flash) req.flash('error_msg', 'Recruiter not found.');
            return res.redirect('/company/team');
        }

        member.isActive = false;
        await member.save();

        if (req.flash) req.flash('success_msg', 'Recruiter deactivated successfully!');
        res.redirect('/company/team');
    } catch (error) {
        console.error('Error deactivating recruiter:', error);
        if (req.flash) req.flash('error_msg', 'An error occurred while deactivating recruiter.');
        res.redirect('/company/team');
    }
});

// --- Candidate Profile View (Read-Only for Recruiters) ---

router.get('/company/applications/:id/candidate', isAuthenticated, requireCompanyRole(['company', 'recruiter']), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            if (req.flash) req.flash('error_msg', 'Application not found.');
            return res.redirect('/company/dashboard');
        }

        const application = await Application.findById(req.params.id)
            .populate('candidate')
            .populate('internship');

        if (!application || !application.internship || !application.candidate) {
            if (req.flash) req.flash('error_msg', 'Application or candidate not found.');
            return res.redirect('/company/dashboard');
        }

        const internship = application.internship;
        const companyName = req.user.companyDetails?.companyName || req.user.name;
        const isAuthorizedCompany = (internship.companyId && req.user.companyId && internship.companyId.toString() === req.user.companyId.toString()) ||
            (internship.postedBy && internship.postedBy.toString() === req.user._id.toString()) ||
            (internship.companyName === companyName);

        if (!isAuthorizedCompany) {
            if (req.flash) req.flash('error_msg', 'You are not authorized to view this candidate profile.');
            return res.redirect('/company/dashboard');
        }

        res.render('company/candidate-profile-view', {
            user: req.user,
            application,
            candidate: application.candidate,
            internship
        });
    } catch (error) {
        console.error('Error loading candidate profile:', error);
        if (req.flash) req.flash('error_msg', 'Failed to load candidate profile.');
        res.redirect('/company/dashboard');
    }
});

module.exports = router;