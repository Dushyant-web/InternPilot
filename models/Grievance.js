const mongoose = require('mongoose');

// Grievances raised by candidates and companies (#161). Each one follows the
// three-tier matrix published on /grievance and keeps every update, so the
// raiser and admins see the same history.

const CATEGORY_KEYS = ['fees', 'stipend', 'misleading', 'account', 'application', 'technical', 'other'];
const STATUS_KEYS = ['open', 'in_review', 'resolved', 'closed'];

const updateSchema = new mongoose.Schema({
    kind: {
        type: String,
        enum: ['created', 'reply', 'response', 'status', 'escalated', 'reopened'],
        required: true
    },
    // Empty for automatic updates such as an overdue escalation.
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byRole: { type: String, enum: ['raiser', 'admin', 'system'], required: true },
    message: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: STATUS_KEYS },
    tier: { type: Number, min: 1, max: 3 },
    // When it happened. An automatic escalation is stamped with the due date
    // it missed, not with the moment someone next opened the ticket.
    at: { type: Date, default: Date.now }
});

const grievanceSchema = new mongoose.Schema({
    ticket: { type: String, required: true, unique: true },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    raiserRole: { type: String, enum: ['candidate', 'company'], required: true },
    // Company side only: which company the raiser acts for.
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    category: { type: String, enum: CATEGORY_KEYS, required: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' },
    status: { type: String, enum: STATUS_KEYS, default: 'open', index: true },
    tier: { type: Number, min: 1, max: 3, default: 1, index: true },
    dueAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date },
    reopenCount: { type: Number, default: 0 },
    updates: [updateSchema]
}, { timestamps: true });

grievanceSchema.index({ status: 1, dueAt: 1 });

// One running number per year for readable tickets like GRV-2026-000123.
const counterSchema = new mongoose.Schema({
    _id: { type: String },
    seq: { type: Number, default: 0 }
}, { versionKey: false });

const Grievance = mongoose.model('Grievance', grievanceSchema);
const GrievanceCounter = mongoose.model('GrievanceCounter', counterSchema);

module.exports = Grievance;
module.exports.GrievanceCounter = GrievanceCounter;
module.exports.CATEGORY_KEYS = CATEGORY_KEYS;
module.exports.STATUS_KEYS = STATUS_KEYS;
