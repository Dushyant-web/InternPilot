const normalize = (skill) => String(skill || '').trim().toLowerCase();

const clean = (skills) => (Array.isArray(skills) ? skills : []).filter(Boolean);

// Kept identical to the scoring that internships and recommendations already
// relied on, so match percentages do not shift for existing data.
function calculateSkillScore(userSkills = [], requiredSkills = []) {
    if (!requiredSkills || !requiredSkills.length) return 100;
    if (!userSkills || !userSkills.length) return 0;

    const userSkillsLower = clean(userSkills).map(normalize);
    let matchCount = 0;

    clean(requiredSkills).forEach(skill => {
        if (userSkillsLower.includes(normalize(skill))) matchCount++;
    });

    return Math.round((matchCount / requiredSkills.length) * 100);
}

// "React" vs "React.js" should not read as a total miss, but two-letter
// overlaps like "Go" inside "Django" should not count either.
function findPartialMatch(requiredSkill, userSkills) {
    const required = normalize(requiredSkill);
    if (required.length < 3) return null;

    return userSkills.find(userSkill => {
        const candidate = normalize(userSkill);
        if (candidate.length < 3 || candidate === required) return false;
        return candidate.includes(required) || required.includes(candidate);
    }) || null;
}

function buildSummary({ hasProfileSkills, totalRequired, matchCount, missing, partial }) {
    if (!totalRequired) {
        return 'This internship has not listed any required skills yet, so there is nothing to compare against.';
    }
    if (!hasProfileSkills) {
        return 'Add the skills you already have to your profile to see how well you fit this role.';
    }

    const base = `You match ${matchCount} of ${totalRequired} required skills.`;

    if (missing.length) {
        return `${base} Consider learning: ${missing.join(', ')}.`;
    }
    if (partial.length) {
        const names = partial.map(item => item.required);
        return `${base} Close but worth confirming: ${names.join(', ')}.`;
    }
    return `${base} Your profile covers everything this role asks for.`;
}

/**
 * Compares a candidate's skills against an internship's required skills.
 * Returns the buckets a view needs plus a short, actionable summary line.
 */
function analyzeSkillGap(userSkills = [], requiredSkills = []) {
    const profileSkills = clean(userSkills);
    const required = clean(requiredSkills);
    const profileSkillsLower = profileSkills.map(normalize);

    const matched = [];
    const partial = [];
    const missing = [];

    required.forEach(skill => {
        if (profileSkillsLower.includes(normalize(skill))) {
            matched.push(skill);
            return;
        }

        const near = findPartialMatch(skill, profileSkills);
        if (near) {
            partial.push({ required: skill, profileSkill: near });
            return;
        }

        missing.push(skill);
    });

    const hasProfileSkills = profileSkills.length > 0;
    const totalRequired = required.length;
    const matchCount = matched.length;

    return {
        hasProfileSkills,
        hasRequiredSkills: totalRequired > 0,
        totalRequired,
        matchCount,
        matched,
        partial,
        missing,
        score: calculateSkillScore(profileSkills, required),
        summary: buildSummary({ hasProfileSkills, totalRequired, matchCount, missing, partial })
    };
}

module.exports = { calculateSkillScore, analyzeSkillGap };
