const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');
const { calculateCandidateMatch } = require('../utils/candidateMatcher');

test('candidate matcher ranks skill, qualification, and location alignment', () => {
    const internship = {
        requiredSkills: ['Node.js', 'React'],
        minQualifications: 'B.Tech',
        location: { district: 'Noida', state: 'UP' }
    };

    const strongMatch = calculateCandidateMatch({
        skills: ['node.js', 'React'],
        skillProfiles: [
            { name: 'node.js', proficiency: 'Advanced' },
            { name: 'React', proficiency: 'Advanced' }
        ],
        education: { qualification: 'B.Tech Computer Science' },
        location: { district: 'Noida', state: 'UP' }
    }, internship);
    const weakMatch = calculateCandidateMatch({
        skills: ['Python'],
        education: { qualification: 'MCA' },
        location: { district: 'Pune', state: 'MH' }
    }, internship);

    assert.equal(strongMatch.score, 100);
    assert.ok(strongMatch.score > weakMatch.score);
    assert.deepEqual(strongMatch.matchingSkills, ['node.js', 'react']);
    assert.deepEqual(strongMatch.matchingSkillProfiles.map(match => match.proficiency), ['Advanced', 'Advanced']);
    assert.match(strongMatch.rationale, /Matching skills: node\.js, react/);
    assert.match(strongMatch.rationale, /Proficiency: Advanced node\.js, Advanced React/);
    assert.match(strongMatch.rationale, /Qualification aligns/);
});

test('company applicants view renders top match and rationale', () => {
    const templatePath = path.join(__dirname, '..', 'views', 'company', 'company-applicants.ejs');
    const template = fs.readFileSync(templatePath, 'utf8').replace("<% layout('layouts/boilerplate') %>", '');
    const application = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Submitted',
        appliedAt: new Date(),
        matchScore: 92,
        matchRationale: 'Matching skills: node.js. Qualification aligns.',
        candidate: {
            name: 'Asha Rao',
            education: { qualification: 'B.Tech' },
            location: { district: 'Noida', state: 'UP' },
            skills: ['Node.js'],
            skillProfiles: [{ name: 'Node.js', proficiency: 'Advanced' }]
        },
        candidateSkillProfiles: [{ name: 'Node.js', proficiency: 'Advanced' }],
        notes: []
    };

    const html = ejs.render(template, {
        internship: { title: 'Backend Intern', vacancies: 1, companyName: 'Acme' },
        applications: [application],
        user: { _id: new mongoose.Types.ObjectId(), role: 'recruiter' }
    });

    assert.match(html, /Top Match #1/);
    assert.match(html, /Matching skills: node\.js/);
    assert.match(html, /Advanced/);
    assert.match(html, /proficiencyFilter/);
});
