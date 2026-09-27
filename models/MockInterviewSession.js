const mongoose = require('mongoose');

const mockInterviewSessionSchema = new mongoose.Schema({
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    experienceLevel: { type: String, enum: ['Entry', 'Mid', 'Senior'], required: true },
    interviewType: { type: String, enum: ['Technical', 'Behavioral', 'System Design', 'Resume Deep-Dive'], required: true },
    mode: { type: String, enum: ['Timed', 'Self-Paced'], required: true },
    resumeReference: { type: mongoose.Schema.Types.ObjectId }, 
    status: { type: String, enum: ['Setup', 'In Progress', 'Completed', 'Abandoned'], default: 'Setup' },
    transcript: [{
        turnId: Number,
        question: String,
        candidateAnswer: String,
        hintUsed: { type: Boolean, default: false },
        reframed: { type: Boolean, default: false },
        durationSeconds: Number,
        timestamp: { type: Date, default: Date.now }
    }],
    evaluation: {
        overallScore: Number,
        strengths: [String],
        improvements: [String],
        dimensionScores: { type: Map, of: Number }, 
        feedback: String
    },
    usage: {
        turns: { type: Number, default: 0 },
        hints: { type: Number, default: 0 },
        reframes: { type: Number, default: 0 }
    }
}, { timestamps: true });

mockInterviewSessionSchema.index({ candidate: 1, createdAt: -1 });

module.exports = mongoose.model('MockInterviewSession', mockInterviewSessionSchema);
