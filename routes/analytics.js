const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Internship = require('../models/Internship');
const cache = require('../utils/cache');

// Landing stats are cached for 60 seconds, shared by every instance when Redis is set up.
const LANDING_STATS_KEY = 'landing-stats';
const LANDING_STATS_SECONDS = 60;

router.get('/analytics/landing-stats', async (req, res) => {
    try {
        const stats = await cache.getOrSet(LANDING_STATS_KEY, LANDING_STATS_SECONDS, async () => {
            const [candidates, companies, internships] = await Promise.all([
                User.countDocuments({ role: 'candidate' }),
                User.countDocuments({ role: 'company' }),
                Internship.countDocuments({ status: 'published' })
            ]);
            return { candidates, companies, internships };
        });

        return res.json(stats);
    } catch (error) {
        console.error('Error fetching landing stats:', error);
        return res.status(500).json({
            error: 'Failed to fetch landing statistics',
            candidates: 0,
            companies: 0,
            internships: 0
        });
    }
});

module.exports = router;
