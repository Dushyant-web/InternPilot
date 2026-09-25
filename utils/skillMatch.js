const normalize = (skill) => String(skill || '').trim().toLowerCase();

const clean = (skills) => (Array.isArray(skills) ? skills : []).filter(Boolean);

/**
 * Percentage of an internship's required skills that a candidate already has.
 *
 * Kept identical to the scoring that internships and recommendations already
 * relied on, so match percentages do not shift for existing data.
 *
 * @param {string[]} userSkills Skills listed on the candidate's profile.
 * @param {string[]} requiredSkills Skills the internship asks for.
 * @returns {number} 0-100. Returns 100 when nothing is required, 0 when the
 *   candidate has no skills at all.
 */
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

/**
 * Finds a profile skill that looks like a differently worded version of a
 * required skill.
 *
 * "React" vs "React.js" should not read as a total miss, but two-letter
 * overlaps like "Go" inside "Django" should not count either, so both sides
 * need at least three characters.
 *
 * @param {string} requiredSkill A single skill the internship asks for.
 * @param {string[]} userSkills Skills listed on the candidate's profile.
 * @returns {string|null} The matching profile skill, or null if none is close.
 */
function findPartialMatch(requiredSkill, userSkills) {
    const required = normalize(requiredSkill);
    if (required.length < 3) return null;

    return userSkills.find(userSkill => {
        const candidate = normalize(userSkill);
        if (candidate.length < 3 || candidate === required) return false;
        return candidate.includes(required) || required.includes(candidate);
    }) || null;
}

/**
 * Builds the single actionable sentence shown above the analysis.
 *
 * Only claims full coverage when every requirement matched exactly, so a
 * loose match never reads as a complete one.
 *
 * @param {object} result Buckets produced by {@link analyzeSkillGap}.
 * @param {boolean} result.hasProfileSkills Whether the profile lists any skill.
 * @param {number} result.totalRequired How many skills the internship asks for.
 * @param {number} result.matchCount How many matched exactly.
 * @param {string[]} result.missing Requirements with no match at all.
 * @param {Array<{required: string, profileSkill: string}>} result.partial
 *   Requirements that only matched loosely.
 * @returns {string} A sentence safe to render as-is.
 */
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
 *
 * Every requirement lands in exactly one bucket: an exact match, a loose
 * match against differently worded profile skill, or missing.
 *
 * @param {string[]} userSkills Skills listed on the candidate's profile.
 * @param {string[]} requiredSkills Skills the internship asks for.
 * @returns {{hasProfileSkills: boolean, hasRequiredSkills: boolean,
 *   totalRequired: number, matchCount: number, matched: string[],
 *   partial: Array<{required: string, profileSkill: string}>,
 *   missing: string[], score: number, summary: string}} Buckets a view can
 *   render directly, plus the score and a summary sentence.
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
