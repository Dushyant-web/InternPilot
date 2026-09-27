const mongoose = require('mongoose');

// Site-wide banners posted from the admin console.
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    audience: { type: String, enum: ['everyone', 'candidates', 'companies'], default: 'everyone' },
    tone: { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
    startsAt: { type: Date, required: true, default: Date.now },
    // Empty means it runs until an admin ends it.
    endsAt: { type: Date },
    endedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // How many in-app notifications went out with it, if any.
    notified: { type: Number, default: 0 }
}, { timestamps: true });

announcementSchema.index({ startsAt: 1, endsAt: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
