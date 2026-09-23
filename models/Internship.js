const mongoose = require("mongoose");

const internshipSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    sector: String,
    title: { type: String, required: true },
    location: {
        district: String,
        state: String
    },
    minQualifications: { type: String, alias: 'minQualification' },
    requiredSkills: [String],
    monthlyStipend: { type: Number, default: 5000 },
    duration: { type: String, default: "12 Months" },
    vacancies: { type: Number, default: 1 },
    embedding: [Number],
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    applicationDeadline: {
        type: Date
    }
}, { toJSON: { virtuals: true }, toObject: { virtuals: true } });

internshipSchema.virtual('company').get(function () {
    return this.companyName;
});

internshipSchema.virtual('stipend').get(function () {
    return this.monthlyStipend;
});

module.exports = mongoose.model("Internship", internshipSchema);
