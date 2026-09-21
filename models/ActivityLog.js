const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: {
        type: String,
        enum: [
            'CREATE_LISTING',
            'EDIT_LISTING',
            'PUBLISH_LISTING',
            'PAUSE_LISTING',
            'RESUME_LISTING',
            'DELETE_LISTING',
            'SHORTLIST_CANDIDATE',
            'UPDATE_APPLICATION_STATUS',
            'ADD_TEAM_MEMBER',
            'REMOVE_TEAM_MEMBER'
        ],
        required: true,
        index: true
    },
    targetType: { type: String, enum: ['Candidate', 'Listing', 'Recruiter', 'Hiring Manager'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetName: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

activityLogSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
