/**
 * Candidate Routes - InternPilot
 * Handles candidate specific actions including application tracking and withdrawal.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Application = require('../models/Application');
const User = require('../models/User');
const { notifyCandidateWithdrawal } = require('../utils/recruiterNotifications');
const { isAuthenticated, authorize } = require('../middleware/auth');
const { formatRelativeTime, formatLocalizedDateTime } = require('../utils/dateFormat');

/**
 * GET /candidate/saved-internships
 * Renders the saved internships dashboard.
 */
router.get('/candidate/saved-internships', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'savedInternships',
            populate: { path: 'companyId', select: 'companyName' }
        }).lean();
        
        res.render('candidate/saved-internships', {
            internships: user.savedInternships || [],
            currentUser: req.user
        });
    } catch (error) {
        console.error('Error fetching saved internships:', error);
        req.flash('error_msg', 'Failed to load saved internships.');
        res.redirect('/');
    }
});

/**
 * POST /candidate/saved-internships/:id/toggle
 * Toggles the saved status of an internship for the candidate.
 */
router.post('/candidate/saved-internships/:id/toggle', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const internshipId = req.params.id;
        
        const index = user.savedInternships.indexOf(internshipId);
        let isSaved = false;
        
        if (index === -1) {
            user.savedInternships.push(internshipId);
            isSaved = true;
        } else {
            user.savedInternships.splice(index, 1);
        }
        
        await user.save();
        res.json({ success: true, isSaved });
    } catch (error) {
        console.error('Error toggling saved internship:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * GET /candidate/my-applications
 * Preserves the legacy URL while using the same canonical application-card
 * renderer as /candidate/applications.
 */
router.get('/candidate/my-applications', isAuthenticated, authorize('candidate'), async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const candidate = await User.findById(userId);
        const applications = await Application.find({ candidate: userId })
            .populate('internship')
            .sort({ statusUpdatedAt: -1, appliedAt: -1 });

        res.render('candidate/candidate-tracker', {
            candidate,
            currentUser: req.user,
            applications,
            pageTitle: 'My Applications',
            formatRelativeTime,
            formatLocalizedDateTime
        });
    } catch (error) {
        console.error('Error fetching candidate applications:', error);
        res.status(500).send('Database Error');
    }
});

/**
 * Core withdrawal logic handler.
 * Supports both POST and PATCH methods for /candidate/applications/:id/withdraw.
 */
async function handleApplicationWithdrawal(req, res) {
    try {
        const { id } = req.params;
        const reason = req.body && req.body.reason ? String(req.body.reason).trim() : '';

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            const errorMsg = 'Invalid application ID provided.';
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        const application = await Application.findById(id).populate('internship');

        if (!application) {
            const errorMsg = 'Application not found.';
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(404).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        // Ownership & IDOR Protection: Only the applicant can withdraw their application
        const candidateId = application.candidate?._id || application.candidate;
        const currentUserId = req.user._id || req.user.id;

        if (!candidateId || candidateId.toString() !== currentUserId.toString()) {
            const errorMsg = 'You are not authorized to withdraw this application.';
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(403).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        // Check if application is already in terminal or non-withdrawable state
        const currentStatus = application.status;
        const normalizedStatus = (currentStatus || '').toLowerCase();

        if (normalizedStatus === 'withdrawn') {
            const errorMsg = 'This application has already been withdrawn.';
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        if (['rejected', 'hired', 'accepted'].includes(normalizedStatus)) {
            const errorMsg = `Applications that are already ${currentStatus.toLowerCase()} cannot be withdrawn.`;
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        // Validate using schema method if present, or enforce permitted statuses
        if (typeof application.canWithdraw === 'function' && !application.canWithdraw()) {
            const errorMsg = `Application in '${currentStatus}' status cannot be withdrawn.`;
            if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            if (req.flash) req.flash('error_msg', errorMsg);
            return res.redirect('/candidate/applications');
        }

        // Soft-delete strategy: update status to 'Withdrawn' with audit details
        application.status = 'Withdrawn';
        application.withdrawnAt = new Date();
        application.withdrawalReason = reason || 'Withdrawn by student';

        // Add audit entry in application notes
        if (Array.isArray(application.notes)) {
            application.notes.push({
                text: `[AUDIT] Application withdrawn by student.${reason ? ` Reason: "${reason}"` : ''}`,
                createdBy: req.user._id,
                createdAt: new Date()
            });
        }

        await application.save();

        // Trigger recruiter notification (non-blocking)
        if (application.internship) {
            notifyCandidateWithdrawal(application, application.internship);
        }

        const successMessage = 'Application withdrawn successfully.';

        if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
            return res.status(200).json({
                success: true,
                message: successMessage,
                application: {
                    id: application._id,
                    status: application.status,
                    withdrawnAt: application.withdrawnAt,
                    withdrawalReason: application.withdrawalReason
                }
            });
        }

        if (req.flash) req.flash('success_msg', successMessage);
        const redirectUrl = req.get('Referrer')?.includes('my-applications') ? '/candidate/my-applications' : '/candidate/applications';
        return res.redirect(redirectUrl);

    } catch (error) {
        console.error('Error withdrawing application:', error);
        if (req.xhr || req.headers.accept?.includes('application/json') || req.is('json')) {
            return res.status(500).json({ success: false, error: 'Internal Server Error while withdrawing application.' });
        }
        if (req.flash) req.flash('error_msg', 'Failed to withdraw application. Please try again.');
        return res.redirect('/candidate/applications');
    }
}

// POST /candidate/applications/:id/withdraw
router.post('/candidate/applications/:id/withdraw', isAuthenticated, authorize('candidate'), handleApplicationWithdrawal);

// PATCH /candidate/applications/:id/withdraw
router.patch('/candidate/applications/:id/withdraw', isAuthenticated, authorize('candidate'), handleApplicationWithdrawal);

module.exports = router;
module.exports.handleApplicationWithdrawal = handleApplicationWithdrawal;
