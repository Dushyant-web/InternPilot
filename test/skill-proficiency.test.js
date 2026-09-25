const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const User = require('../models/User');
const {
    buildSkillProfiles,
    parseSkillProfiles,
    skillNames
} = require('../utils/skillProfiles');
const { calculateCandidateMatch } = require('../utils/candidateMatcher');
const { analyzeSkillGap } = require('../utils/skillMatch');
const { hasSameProfiles } = require('../migrate-skill-proficiencies');

test('legacy string skills become Intermediate profiles without losing names', () => {
    const profiles = buildSkillProfiles({
        skills: ['React', ' react ', 'Node.js']
    });

    assert.deepEqual(profiles, [
        { name: 'React', proficiency: 'Intermediate' },
        { name: 'Node.js', proficiency: 'Intermediate' }
    ]);
    assert.deepEqual(skillNames(profiles), ['React', 'Node.js']);
});

test('profile form parsing deduplicates skills and keeps the highest submitted proficiency', () => {
    const profiles = parseSkillProfiles({
        skillName: ['React', ' react ', 'MongoDB'],
        skillProficiency: ['Beginner', 'Advanced', 'not-a-level']
    });

    assert.deepEqual(profiles, [
        { name: 'React', proficiency: 'Advanced' },
        { name: 'MongoDB', proficiency: 'Intermediate' }
    ]);
});

test('User schema permits only the three supported proficiency values', async () => {
    const valid = new User({
        name: 'Candidate',
        email: 'skill-level-valid@example.test',
        role: 'candidate',
        skillProfiles: [{ name: 'React', proficiency: 'Advanced' }]
    });
    await assert.doesNotReject(valid.validate());

    const invalid = new User({
        name: 'Candidate',
        email: 'skill-level-invalid@example.test',
        role: 'candidate',
        skillProfiles: [{ name: 'React', proficiency: 'Expert' }]
    });
    await assert.rejects(invalid.validate(), /proficiency/);
});

test('matching ranks Beginner below Intermediate below Advanced and preserves legacy behaviour', () => {
    const internship = { requiredSkills: ['React'] };
    const beginner = calculateCandidateMatch({
        skillProfiles: [{ name: 'React', proficiency: 'Beginner' }]
    }, internship);
    const intermediate = calculateCandidateMatch({
        skillProfiles: [{ name: 'React', proficiency: 'Intermediate' }]
    }, internship);
    const advanced = calculateCandidateMatch({
        skillProfiles: [{ name: 'React', proficiency: 'Advanced' }]
    }, internship);
    const legacy = calculateCandidateMatch({ skills: ['React'] }, internship);

    assert.ok(beginner.score < intermediate.score);
    assert.ok(intermediate.score < advanced.score);
    assert.equal(legacy.score, intermediate.score);
    assert.match(advanced.rationale, /Proficiency: Advanced React/);
});

test('skill-gap analysis shows Beginner skills as developing instead of fully matched', () => {
    const analysis = analyzeSkillGap({
        skillProfiles: [
            { name: 'React', proficiency: 'Beginner' },
            { name: 'Node.js', proficiency: 'Advanced' }
        ]
    }, ['React', 'Node.js', 'MongoDB']);

    assert.deepEqual(analysis.matched, ['Node.js']);
    assert.deepEqual(analysis.developing, [{
        required: 'React',
        profileSkill: 'React',
        proficiency: 'Beginner',
        weight: 0.6
    }]);
    assert.deepEqual(analysis.missing, ['MongoDB']);
    assert.equal(analysis.score, 53);
});

test('candidate and recruiter views include editable and visible proficiency controls', () => {
    const candidateProfile = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'candidate', 'candidate-profile.ejs'),
        'utf8'
    );
    const applicantsTemplatePath = path.join(__dirname, '..', 'views', 'company', 'company-applicants.ejs');
    const applicantsTemplate = fs.readFileSync(applicantsTemplatePath, 'utf8')
        .replace("<% layout('layouts/boilerplate') %>", '');

    assert.match(candidateProfile, /name="skillName"/);
    assert.match(candidateProfile, /name="skillProficiency"/);
    assert.match(candidateProfile, /Beginner/);
    assert.match(candidateProfile, /Intermediate/);
    assert.match(candidateProfile, /Advanced/);
    assert.doesNotThrow(() => ejs.compile(applicantsTemplate, { filename: applicantsTemplatePath }));
});

test('migration comparison detects when a legacy profile still needs a backfill', () => {
    assert.equal(
        hasSameProfiles([], [{ name: 'React', proficiency: 'Intermediate' }]),
        false
    );
    assert.equal(
        hasSameProfiles(
            [{ name: 'React', proficiency: 'Intermediate' }],
            [{ name: 'React', proficiency: 'Intermediate' }]
        ),
        true
    );
});
