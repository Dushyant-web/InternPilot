/**
 * conflictDetector.js
 * ---------------------------------------------------------------------------
 * Compares an existing user profile against freshly-parsed resume data and
 * returns:
 *   • hasConflicts  – boolean flag
 *   • conflicts     – array of { fieldKey, fieldLabel, currentValue, parsedValue }
 *   • autoMerged    – object of non-conflicting fields ready to save
 *
 * Design decisions
 * ----------------
 * 1. Normalisation is applied before comparison so cosmetic differences
 *    (whitespace, casing) don't trigger false conflicts.
 * 2. Arrays (e.g. skills) are compared as sorted, lowercased sets so
 *    ["React", "Node.js"] and ["node.js", "react"] are treated as equal.
 * 3. Empty / null / undefined values on either side are treated as
 *    "auto-mergeable" — the non-empty side wins without user intervention.
 * 4. Only fields that both the profile AND the resume provide non-empty,
 *    **different** values for are surfaced as conflicts.
 */

// ── Field definitions ──────────────────────────────────────────────────────
// Each entry maps a logical fieldKey to:
//   • label   – human-readable label for the UI
//   • get     – extractor from a profile / parsed data object
//   • type    – 'string' | 'array'  (drives normalisation strategy)
const FIELD_DEFS = [
    {
        key: 'skills',
        label: 'Skills',
        get: (o) => o.skills,
        type: 'array'
    },
    {
        key: 'education.qualification',
        label: 'Qualification',
        get: (o) => o.education?.qualification || o.qualification,
        type: 'string'
    },
    {
        key: 'education.institutionName',
        label: 'Institution',
        get: (o) => o.education?.institutionName || o.institution,
        type: 'string'
    },
    {
        key: 'location.district',
        label: 'District',
        get: (o) => o.location?.district,
        type: 'string'
    },
    {
        key: 'location.state',
        label: 'State',
        get: (o) => o.location?.state,
        type: 'string'
    },
    {
        key: 'name',
        label: 'Full Name',
        get: (o) => o.name,
        type: 'string'
    },
    {
        key: 'age',
        label: 'Age',
        get: (o) => o.age,
        type: 'string'   // treated as scalar; toString used for comparison
    },
    {
        key: 'familyIncome',
        label: 'Family Income',
        get: (o) => o.familyIncome,
        type: 'string'
    }
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true when a value is semantically empty.
 */
function isEmpty(val) {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string' && val.trim() === '') return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
}

/**
 * Normalise a string for comparison purposes.
 */
function normStr(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase();
}

/**
 * Normalise an array for comparison – returns a sorted, deduplicated list of
 * lowercased, trimmed strings.
 */
function normArr(arr) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.filter(Boolean).map(s => String(s).trim().toLowerCase()))].sort();
}

/**
 * Compare two values according to their field type.
 * Returns `true` when they are semantically equal.
 */
function isEqual(a, b, type) {
    if (type === 'array') {
        const na = normArr(a);
        const nb = normArr(b);
        return na.length === nb.length && na.every((v, i) => v === nb[i]);
    }
    return normStr(a) === normStr(b);
}

/**
 * Format a value for display in the conflict UI.
 */
function displayValue(val) {
    if (isEmpty(val)) return '';
    if (Array.isArray(val)) return val.filter(Boolean).join(', ');
    return String(val).trim();
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Detect conflicts between an existing user profile and parsed resume data.
 *
 * @param {Object} existingProfile - The current user document (from DB).
 * @param {Object} parsedData      - The freshly-parsed resume data.
 * @returns {{ hasConflicts: boolean, conflicts: Array, autoMerged: Object }}
 */
function detectProfileConflicts(existingProfile, parsedData) {
    const conflicts = [];
    const autoMerged = {};

    for (const field of FIELD_DEFS) {
        const current = field.get(existingProfile || {});
        const parsed  = field.get(parsedData || {});

        const currentEmpty = isEmpty(current);
        const parsedEmpty  = isEmpty(parsed);

        // Both empty → nothing to do
        if (currentEmpty && parsedEmpty) continue;

        // Only one side has a value → auto-merge (non-empty wins)
        if (currentEmpty && !parsedEmpty) {
            autoMerged[field.key] = parsed;
            continue;
        }
        if (!currentEmpty && parsedEmpty) {
            // Keep the existing value (nothing new from resume)
            continue;
        }

        // Both sides have values → check for actual conflict
        if (isEqual(current, parsed, field.type)) {
            // Values are the same after normalisation – no conflict
            continue;
        }

        // Real conflict – surface it for the user
        conflicts.push({
            fieldKey:     field.key,
            fieldLabel:   field.label,
            currentValue: displayValue(current),
            parsedValue:  displayValue(parsed)
        });
    }

    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        autoMerged
    };
}

module.exports = { detectProfileConflicts, FIELD_DEFS };
