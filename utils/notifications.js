const Notification = require('../models/Notification');
const User = require('../models/User');

function normalise(value) {
    return (value || '').trim().toLowerCase();
}

function hasLocationMatch(candidate, internship) {
    const candidateDistrict = normalise(candidate.location?.district);
    const candidateState = normalise(candidate.location?.state);
    const internshipDistrict = normalise(internship.location?.district);
    const internshipState = normalise(internship.location?.state);

    // Do not exclude candidates with incomplete profiles. When both sides
    // contain a location, a district match is preferred, then a state match.
    if ((!candidateDistrict && !candidateState) || (!internshipDistrict && !internshipState)) {
        return true;
    }

    if (candidateDistrict && internshipDistrict) {
        return candidateDistrict === internshipDistrict;
    }

    return !candidateState || !internshipState || candidateState === internshipState;
}

function hasQualificationMatch(candidate, internship) {
    const requirement = normalise(internship.minQualifications);
    const qualification = normalise(candidate.education?.qualification);

    if (!requirement || requirement === 'any' || !qualification) return true;
    return requirement.includes(qualification) || qualification.includes(requirement);
}

function hasSkillMatch(candidate, internship) {
    const requiredSkills = (internship.requiredSkills || []).map(normalise).filter(Boolean);
    if (!requiredSkills.length) return true;

    const candidateSkills = new Set((candidate.skills || []).map(normalise).filter(Boolean));
    return requiredSkills.some(skill => candidateSkills.has(skill));
}

function isRelevantInternship(candidate, internship) {
    return hasSkillMatch(candidate, internship)
        && hasLocationMatch(candidate, internship)
        && hasQualificationMatch(candidate, internship);
}

async function notifyRelevantCandidates(internship) {
    // A draft or closed listing must never appear as a new opportunity.
    // Explicitly requiring "published" also keeps this safe if new listing
    // states are introduced later.
    if (!internship || internship.status !== 'published') return 0;

    const candidates = await User.find({
        role: 'candidate',
        isEmailVerified: true,
        isActive: true
    })
        .select('_id skills location education')
        .lean();

    const matchingCandidates = candidates.filter(candidate => isRelevantInternship(candidate, internship));
    if (!matchingCandidates.length) return 0;

    const title = 'New internship match';
    const message = `${internship.title} at ${internship.companyName} matches your profile.`;

    await Notification.bulkWrite(
        matchingCandidates.map(candidate => ({
            updateOne: {
                filter: {
                    recipient: candidate._id,
                    internship: internship._id,
                    type: 'new_matching_internship'
                },
                update: {
                    $setOnInsert: {
                        recipient: candidate._id,
                        type: 'new_matching_internship',
                        title,
                        message,
                        link: '/internships',
                        internship: internship._id,
                        isRead: false
                    }
                },
                upsert: true
            }
        })),
        { ordered: false }
    );

    return matchingCandidates.length;
}

async function notifyApplicationStatusChange(application, internship, status) {
    const isShortlisted = status === 'Shortlisted';

    await Notification.create({
        recipient: application.candidate._id || application.candidate,
        type: isShortlisted ? 'application_shortlisted' : 'application_status',
        title: isShortlisted ? 'You have been shortlisted!' : 'Application status updated',
        message: isShortlisted
            ? `You have been shortlisted for ${internship.title} at ${internship.companyName}.`
            : `Your application for ${internship.title} at ${internship.companyName} is now ${status}.`,
        link: '/candidate/applications',
        internship: internship._id,
        application: application._id
    });
}

module.exports = {
    isRelevantInternship,
    notifyRelevantCandidates,
    notifyApplicationStatusChange
};
