const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
    internship: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Internship",
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: [
            'Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Rejected', 'Withdrawn',
            'submitted', 'pending', 'under_review', 'shortlisted', 'hired', 'rejected', 'withdrawn'
        ],
        default: 'Submitted'
    },
    interview: {
        status: {
            type: String,
            enum: ['Scheduled', 'Rescheduled', 'Cancelled']
        },
        scheduledAt: { type: Date },
        duration: { type: Number, default: 30 }, // in minutes
        mode: {
            type: String,
            enum: ['Online', 'Phone', 'In-Person']
        },
        meetingLink: { type: String },
        location: { type: String },
        instructions: { type: String },
        scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date },
        updatedAt: { type: Date },
        cancelledAt: { type: Date },
        cancelReason: { type: String }
    },
    matchScore: { type: Number, default: 0 },
    appliedAt: { type: Date, default: Date.now },
    withdrawnAt: { type: Date },
    withdrawalReason: { type: String, trim: true, default: null },
    notes: [{
        text: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date }
    }]
}, { timestamps: true });

// Allowed statuses from which an application can be transitioned to 'Withdrawn'
const WITHDRAWABLE_STATUSES = ['Submitted', 'Under Review', 'pending', 'under_review', 'Shortlisted', 'submitted', 'Interview'];
// Terminal statuses that forbid withdrawal
const TERMINAL_STATUSES = ['Rejected', 'rejected', 'Hired', 'hired', 'Withdrawn', 'withdrawn'];

/**
 * Checks whether this application can currently be withdrawn by the student.
 * Permitted when pending/submitted or under review (and shortlisted).
 * Blocked if already rejected, hired, or already withdrawn.
 * @returns {boolean}
 */
applicationSchema.methods.canWithdraw = function () {
    const s = this.status;
    if (!s) return false;
    if (TERMINAL_STATUSES.includes(s)) return false;
    return WITHDRAWABLE_STATUSES.includes(s);
};

/**
 * Performs soft-delete / status transition to Withdrawn, recording audit metadata.
 * @param {string} [reason] - Optional reason for withdrawal (e.g. accepted another offer)
 * @returns {this}
 */
applicationSchema.methods.withdraw = function (reason) {
    if (!this.canWithdraw()) {
        const err = new Error(`Application currently in '${this.status}' status cannot be withdrawn.`);
        err.statusCode = 400;
        err.code = 'INVALID_STATUS_TRANSITION';
        throw err;
    }
    this.status = 'Withdrawn';
    this.withdrawnAt = new Date();
    if (reason && typeof reason === 'string') {
        this.withdrawalReason = reason.trim();
    }
    return this;
};

// Static helper to expose allowed and terminal status lists
applicationSchema.statics.WITHDRAWABLE_STATUSES = WITHDRAWABLE_STATUSES;
applicationSchema.statics.TERMINAL_STATUSES = TERMINAL_STATUSES;

module.exports = mongoose.model("Application", applicationSchema);