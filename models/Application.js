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
        enum: ['Submitted', 'Under Review', 'Shortlisted', 'Rejected'],
        default: 'Submitted'
    },
    matchScore: { type: Number, default: 0 },
    appliedAt: { type: Date, default: Date.now },
    notes: [{
        text: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date }
    }]
});

module.exports = mongoose.model("Application", applicationSchema);