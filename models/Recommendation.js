const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    candidate: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    internship: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Internship', 
        required: true 
    },
    aiMatchScore: { 
        type: Number, 
        required: true,
        min: 0,
        max: 100
    },
    skillGapAnalysis: { 
        type: String, 
        required: true 
    },
    matchReasoning: { 
        type: String, 
        required: true 
    },
    isFallback: {
        type: Boolean,
        default: false
    },
    generatedAt: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// Prevent duplicate recommendations for the same candidate/internship pair
recommendationSchema.index({ candidate: 1, internship: 1 }, { unique: true });

// TTL Index: automatically delete stale recommendations after 7 days
recommendationSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 604800 }); 

module.exports = mongoose.model('Recommendation', recommendationSchema);
