const ActivityLog = require('../models/ActivityLog');

async function logActivity(payload) {
    return ActivityLog.create(payload);
}

function logRecruiterActivity(req, payload) {
    const companyId = req.user?.companyId || req.user?._id;
    if (!companyId || !req.user?._id) return Promise.resolve(null);

    return logActivity({
        companyId,
        actorId: req.user._id,
        ...payload
    }).catch(error => {
        console.error('Failed to record recruiter activity:', error);
        return null;
    });
}

module.exports = { logActivity, logRecruiterActivity };