const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const { isAuthenticated } = require('../middleware/auth');
const { requireCompanyPermission } = require('../middleware/companyAccess');

const router = express.Router();

function toPositiveInteger(value, fallback, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, maximum);
}

router.get('/companies/:companyId/activity-logs', isAuthenticated, requireCompanyPermission('team:manage'), async (req, res) => {
    try {
        if (String(req.company._id) !== String(req.params.companyId)) {
            return res.status(403).json({ error: 'You can only view your own company activity.' });
        }

        const page = toPositiveInteger(req.query.page, 1, 1000000);
        const limit = toPositiveInteger(req.query.limit, 25, 100);
        const filter = { companyId: req.company._id };
        if (req.query.actor) filter.actorId = req.query.actor;
        if (req.query.action) filter.action = req.query.action;

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .populate('actorId', 'name email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(filter)
        ]);

        res.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error loading activity logs:', error);
        res.status(500).json({ error: 'Unable to load activity logs.' });
    }
});

router.get('/company/activity', isAuthenticated, requireCompanyPermission('team:manage'), async (req, res) => {
    res.render('company/activity', { user: req.user, companyId: req.company._id.toString() });
});

module.exports = router;
