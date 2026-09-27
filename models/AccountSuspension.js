const mongoose = require('mongoose');

// Sign-in suspensions set from the admin console. Kept apart from the User
// model so the history stays: a user can be suspended and reactivated many
// times, but only one suspension can be active at once.
const accountSuspensionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true, index: true },
    liftedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    liftedAt: { type: Date },
    liftReason: { type: String, default: '', trim: true, maxlength: 1000 }
}, { timestamps: true });

// History lookups, plus at most one active suspension per user.
accountSuspensionSchema.index({ user: 1, createdAt: -1 });
accountSuspensionSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { active: true } });

module.exports = mongoose.model('AccountSuspension', accountSuspensionSchema);
