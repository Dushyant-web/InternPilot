const mongoose = require('mongoose');

const resumeProblemSetSchema = new mongoose.Schema({
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceResumeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    problems: [{
        title: String,
        scenario: String,
        constraints: [String],
        objective: String,
        difficulty: String,
        relevantResumeEvidence: String,
        targetedQuestions: [String],
        candidateSolution: String,
        submittedAt: Date
    }]
}, { timestamps: true });

resumeProblemSetSchema.index({ candidate: 1, createdAt: -1 });

module.exports = mongoose.model('ResumeProblemSet', resumeProblemSetSchema);
