const express = require('express');
const router = express.Router();

/**
 * Public Informational & Policy Pages
 * Handles footer navigation and official PMIS portal guidance routes.
 */

// About InternPilot & PMIS Scheme
router.get(['/about', '/about-us'], (req, res) => {
    res.render('extras/about');
});

// Official PMIS Scheme Guidelines & Eligibility
router.get(['/guidelines', '/scheme-guidelines'], (req, res) => {
    res.render('extras/guidelines');
});

// Contact & Helpdesk Information
router.get(['/contact', '/contact-us', '/help', '/support'], (req, res) => {
    res.render('extras/contact');
});

// Citizen Grievance Redressal Mechanism
router.get(['/grievance', '/grievances'], (req, res) => {
    res.render('extras/grievance');
});

// Privacy & Data Protection Policy (DPDP Act)
router.get(['/privacy', '/privacy-policy'], (req, res) => {
    res.render('extras/privacy');
});

// Terms & Conditions of Portal Usage
router.get(['/terms', '/terms-and-conditions', '/terms-of-service', '/terms-of-use'], (req, res) => {
    res.render('extras/terms');
});

// Government Hyperlinking Policy
router.get(['/hyperlinking', '/hyperlinking-policy', '/hyperlink-policy'], (req, res) => {
    res.render('extras/hyperlinking');
});

// Directory alias / redirect for backward compatibility
router.get('/directory', (req, res) => {
    res.redirect('/internships');
});

module.exports = router;
