function normalize(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeList(values) {
    return (Array.isArray(values) ? values : [])
        .map(normalize)
        .filter(Boolean);
}

function calculateCandidateMatch(candidate = {}, internship = {}) {
    const requiredSkills = normalizeList(internship.requiredSkills);
    const candidateSkills = normalizeList(candidate.skills);
    const matchingSkills = requiredSkills.filter(skill => candidateSkills.includes(skill));
    const skillScore = requiredSkills.length === 0
        ? 35
        : Math.round((matchingSkills.length / requiredSkills.length) * 70);

    const candidateQualification = normalize(candidate.education?.qualification);
    const requiredQualification = normalize(internship.minQualifications);
    const qualificationMatches = !requiredQualification || requiredQualification === 'any'
        ? true
        : Boolean(candidateQualification) && (candidateQualification.includes(requiredQualification) || requiredQualification.includes(candidateQualification));
    const qualificationScore = requiredQualification && requiredQualification !== 'any'
        ? (qualificationMatches ? 15 : 0)
        : 15;

    const candidateDistrict = normalize(candidate.location?.district);
    const candidateState = normalize(candidate.location?.state);
    const internshipDistrict = normalize(internship.location?.district);
    const internshipState = normalize(internship.location?.state);
    const locationScore = candidateDistrict && internshipDistrict && candidateDistrict === internshipDistrict
        ? 15
        : candidateState && internshipState && candidateState === internshipState ? 8 : 0;

    const score = Math.min(skillScore + qualificationScore + locationScore, 100);
    const rationale = [];
    if (matchingSkills.length) rationale.push(`Matching skills: ${matchingSkills.join(', ')}`);
    if (requiredSkills.length && !matchingSkills.length) rationale.push('No required skills matched yet');
    if (requiredQualification) rationale.push(qualificationMatches ? 'Qualification aligns' : 'Qualification needs review');
    if (locationScore) rationale.push(locationScore === 15 ? 'Same district' : 'Same state');
    if (!rationale.length) rationale.push('Limited profile data available');

    return {
        score,
        matchingSkills,
        qualificationMatches,
        rationale: rationale.join('. ') + '.'
    };
}

function calculatePreFilterScore(candidate, internship) {
    return calculateCandidateMatch(candidate, internship).score;
}

module.exports = { calculateCandidateMatch, calculatePreFilterScore };