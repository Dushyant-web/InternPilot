const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['application_status', 'application_shortlisted', 'new_matching_internship'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '/notifications' },
    internship: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Internship'
    },
    application: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Application'
    },
    isRead: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
    { recipient: 1, internship: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { type: 'new_matching_internship' }
    }
);

module.exports = mongoose.model('Notification', notificationSchema);
