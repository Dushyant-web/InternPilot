const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isRelevantInternship,
    notifyRelevantCandidates
} = require('../utils/notifications');

const matchingCandidate = {
    skills: ['JavaScript', 'MongoDB'],
    location: { district: 'Pune', state: 'Maharashtra' },
    education: { qualification: 'B.Tech' }
};

const matchingInternship = {
    status: 'published',
    requiredSkills: ['javascript'],
    location: { district: 'Pune', state: 'Maharashtra' },
    minQualifications: 'B.Tech'
};

test('recognises a relevant internship using normalized skills, location, and qualification', () => {
    assert.equal(isRelevantInternship(matchingCandidate, matchingInternship), true);
    assert.equal(
        isRelevantInternship(matchingCandidate, {
            ...matchingInternship,
            requiredSkills: ['Python']
        }),
        false
    );
});

test('does not query candidates for draft or closed internships', async () => {
    assert.equal(await notifyRelevantCandidates({ status: 'draft' }), 0);
    assert.equal(await notifyRelevantCandidates({ status: 'closed' }), 0);
});
