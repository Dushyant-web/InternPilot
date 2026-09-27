const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const User = require('../models/User');
const { isAuthenticated, authorize } = require('../middleware/auth');
const { enforceSuspension, suspendUser, reactivateUser } = require('../utils/suspensions');
const { deleteAccount } = require('../utils/accountDeletion');
const announcements = require('../utils/announcements');
const analytics = require('../utils/adminAnalytics');
const directory = require('../utils/adminDirectory');
const listingRisk = require('../utils/listingRisk');
const { listActions, logAdminAction, ACTION_LABELS } = require('../utils/adminAudit');

// These two run on every request, which is why the router is mounted ahead
// of the page routes: suspended accounts are signed out, and pages get the
// live announcement banners.
router.use(enforceSuspension);
router.use(announcements.loadAnnouncements);

const adminOnly = [isAuthenticated, authorize('admin')];
const section = key => (req, res, next) => {
    res.locals.consoleSection = key;
    next();
};

const flashAndGo = (req, res, url, error, success) => {
    if (req.flash) req.flash(error ? 'error_msg' : 'success_msg', error || success);
    return res.redirect(url);
};

function sendCsv(res, filename, csv) {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-store');
    // The byte-order mark makes Excel read ₹ and Indian names correctly.
    res.send(`﻿${csv}`);
}

// Only ever send the admin back to a console page.
const safeBack = (value, fallback) => (/^\/admin\/[a-z-]+(\?[\w=&%.+-]*)?$/i.test(String(value || '')) ? value : fallback);

router.get('/admin', ...adminOnly, (req, res) => res.redirect('/admin/overview'));

// --- Overview ---

router.get('/admin/overview', ...adminOnly, section('overview'), async (req, res, next) => {
    try {
        const data = await analytics.overview(req.query.range);
        res.render('admin-console/overview', { data, ranges: analytics.RANGES });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/overview.csv', ...adminOnly, async (req, res, next) => {
    try {
        const data = await analytics.overview(req.query.range);
        await logAdminAction(req.user, { action: 'export.overview', targetType: 'report', targetLabel: data.rangeLabel });
        sendCsv(res, `internpilot-overview-${data.range}-days.csv`, analytics.overviewCsv(data));
    } catch (err) {
        next(err);
    }
});

// --- Users ---

router.get('/admin/users', ...adminOnly, section('users'), async (req, res, next) => {
    try {
        const filters = {
            q: String(req.query.q || ''),
            role: String(req.query.role || ''),
            status: String(req.query.status || ''),
            page: req.query.page
        };
        const result = await directory.listUsers(filters);
        res.render('admin-console/users', { ...result, filters, roles: directory.ROLES });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/users/:id', ...adminOnly, section('users'), async (req, res, next) => {
    try {
        const detail = await directory.userDetail(req.params.id, req.user);
        if (!detail) return next();
        return res.render('admin-console/user', detail);
    } catch (err) {
        return next(err);
    }
});

const loadTarget = id => (mongoose.Types.ObjectId.isValid(id) ? User.findById(id).select('name email role').lean() : null);

router.post('/admin/users/:id/suspend', ...adminOnly, async (req, res, next) => {
    try {
        const { error } = await suspendUser(req.user, await loadTarget(req.params.id), req.body.reason);
        return flashAndGo(req, res, `/admin/users/${req.params.id}`, error, 'Sign-in suspended. They are signed out on their next request.');
    } catch (err) {
        return next(err);
    }
});

router.post('/admin/users/:id/reactivate', ...adminOnly, async (req, res, next) => {
    try {
        const { error } = await reactivateUser(req.user, await loadTarget(req.params.id), req.body.note);
        return flashAndGo(req, res, `/admin/users/${req.params.id}`, error, 'Account reactivated and the user was notified.');
    } catch (err) {
        return next(err);
    }
});

router.post('/admin/users/:id/delete', ...adminOnly, async (req, res, next) => {
    try {
        const target = await loadTarget(req.params.id);
        const { error, removed } = await deleteAccount(req.user, target, { confirmEmail: req.body.confirmEmail, reason: req.body.reason });
        if (error) return flashAndGo(req, res, `/admin/users/${req.params.id}`, error);
        const applications = removed.applications ? ` with ${removed.applications} application${removed.applications === 1 ? '' : 's'}` : '';
        return flashAndGo(req, res, '/admin/users', null, `Account ${target.email} was deleted${applications}. The audit log has the details.`);
    } catch (err) {
        return next(err);
    }
});

// --- Listings ---

router.get('/admin/listings', ...adminOnly, section('listings'), async (req, res, next) => {
    try {
        const filters = {
            status: String(req.query.status || 'published'),
            risk: String(req.query.risk || ''),
            q: String(req.query.q || ''),
            page: req.query.page
        };
        const result = await listingRisk.listingsForReview(filters);
        res.render('admin-console/listings', { ...result, filters, rules: listingRisk.RISK_RULES, currentUrl: req.originalUrl });
    } catch (err) {
        next(err);
    }
});

router.post('/admin/listings/:id/moderate', ...adminOnly, async (req, res, next) => {
    try {
        const { error, to } = await listingRisk.moderateListing(req.user, req.params.id, req.body.action, req.body.reason);
        return flashAndGo(req, res, safeBack(req.body.back, '/admin/listings'), error, `Listing ${to === 'published' ? 'is live again' : `is now ${to}`}. The company was notified.`);
    } catch (err) {
        return next(err);
    }
});

// --- Applications ---

const applicationFilters = query => ({
    status: String(query.status || ''),
    q: String(query.q || ''),
    from: String(query.from || ''),
    to: String(query.to || ''),
    page: query.page
});

router.get('/admin/applications', ...adminOnly, section('applications'), async (req, res, next) => {
    try {
        const filters = applicationFilters(req.query);
        const result = await directory.listApplications(filters);
        const csvQuery = new URLSearchParams({ status: filters.status, q: filters.q, from: filters.from, to: filters.to }).toString();
        res.render('admin-console/applications', { ...result, filters, statuses: directory.APPLICATION_STATUSES, csvQuery });
    } catch (err) {
        next(err);
    }
});

router.get('/admin/applications.csv', ...adminOnly, async (req, res, next) => {
    try {
        const filters = applicationFilters(req.query);
        const csv = await directory.applicationsCsv(filters);
        await logAdminAction(req.user, {
            action: 'export.applications',
            targetType: 'report',
            targetLabel: 'Applications',
            details: { status: filters.status, q: filters.q, from: filters.from, to: filters.to }
        });
        sendCsv(res, 'internpilot-applications.csv', csv);
    } catch (err) {
        next(err);
    }
});

// --- Announcements ---

const renderAnnouncements = async (res, { values = {}, errors = [], status = 200 } = {}) => {
    res.status(status).render('admin-console/announcements', {
        items: await announcements.listAnnouncements(),
        values,
        errors,
        audiences: announcements.AUDIENCES,
        tones: announcements.TONES,
        limits: announcements.LIMITS
    });
};

router.get('/admin/announcements', ...adminOnly, section('announcements'), async (req, res, next) => {
    try {
        await renderAnnouncements(res);
    } catch (err) {
        next(err);
    }
});

router.post('/admin/announcements', ...adminOnly, section('announcements'), async (req, res, next) => {
    try {
        const result = await announcements.createAnnouncement(req.user, req.body);
        if (!result.announcement) return renderAnnouncements(res, { values: req.body, errors: result.errors, status: 400 });
        const sent = result.announcement.notified;
        return flashAndGo(req, res, '/admin/announcements', null,
            `Announcement posted.${sent ? ` ${sent} notifications sent.` : ''}`);
    } catch (err) {
        return next(err);
    }
});

router.post('/admin/announcements/:id/end', ...adminOnly, async (req, res, next) => {
    try {
        const valid = mongoose.Types.ObjectId.isValid(req.params.id);
        const { error } = valid ? await announcements.endAnnouncement(req.user, req.params.id) : { error: 'Announcement not found.' };
        return flashAndGo(req, res, '/admin/announcements', error, 'Announcement ended. It no longer shows on the site.');
    } catch (err) {
        return next(err);
    }
});

// --- Audit log ---

router.get('/admin/audit', ...adminOnly, section('audit'), async (req, res, next) => {
    try {
        const action = String(req.query.action || '');
        const result = await listActions({ action, page: req.query.page });
        res.render('admin-console/audit', { ...result, actions: ACTION_LABELS, filters: { action } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
