/**
 * Utility helper for parsing, building Mongoose queries, and preserving URL query state
 * for Internship search, filtering, sorting, and pagination (GitHub Issue #10).
 */

/**
 * Escapes regex special characters to prevent regex injection and syntax errors.
 * @param {string} text
 * @returns {string}
 */
function escapeRegex(text = '') {
    return text.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
}

// Caps how many values a multi-select filter accepts from the URL, so a
// crafted query string cannot build an unbounded $in.
const MAX_LIST_ITEMS = 20;

// Listings per page when the URL does not say. Left out of generated URLs so
// "Clear all" really produces a bare /internships.
// Default page size of 12 satisfies issue #9 (12-20 items) and fits 1, 2, and 3-column responsive grids.
const DEFAULT_LIMIT = 12;

// Duration is free text on the listing ("12 Months", "6 weeks"), so it is
// filtered by range rather than exact value. Each bucket is (min, max].
const DURATION_BUCKETS = [
    { key: 'upto3', label: 'Up to 3 months', min: 0, max: 3 },
    { key: '3to6', label: '3 to 6 months', min: 3, max: 6 },
    { key: '6to12', label: '6 to 12 months', min: 6, max: 12 },
    { key: 'over12', label: 'Over 12 months', min: 12, max: Infinity }
];

/**
 * Reads a multi-value filter from the query string.
 *
 * Accepts repeated keys (`skills=a&skills=b`, which Express turns into an
 * array) or a comma separated string (`skills=a,b`, which is what
 * buildQueryString writes). Blank and duplicate values are dropped,
 * duplicates compared case-insensitively.
 *
 * @param {string|string[]|undefined} value
 * @returns {string[]}
 */
function parseList(value) {
    const raw = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
    const seen = new Set();
    const list = [];

    raw.forEach(item => {
        if (typeof item !== 'string') return;
        const clean = item.trim();
        const key = clean.toLowerCase();
        if (!clean || seen.has(key)) return;
        seen.add(key);
        list.push(clean);
    });

    return list.slice(0, MAX_LIST_ITEMS);
}

/**
 * Reads a rupee amount from the query string.
 *
 * @param {string|string[]|undefined} value "5000", "5,000" and "₹5000" all work.
 * @returns {number|null} A whole, non-negative number, or null when missing or invalid.
 */
function parseAmount(value) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === undefined || raw === null || raw === '') return null;

    const amount = Number(String(raw).replace(/[,\s₹]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return null;
    return Math.floor(amount);
}

/**
 * Converts a free text duration into months.
 *
 * Understands years, months, weeks and days. A bare number is read as months,
 * which matches the "12 Months" default on the Internship model.
 *
 * @param {string|number|null|undefined} text e.g. "12 Months", "1 year", "8 weeks"
 * @returns {number|null} Months, or null when no positive number can be found.
 */
function parseDurationMonths(text) {
    if (text === undefined || text === null) return null;

    const match = String(text).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|mos?|weeks?|wks?|days?)?/);
    if (!match) return null;

    const amount = parseFloat(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const unit = match[2] || 'month';
    if (unit.startsWith('y')) return amount * 12;
    if (unit.startsWith('w')) return (amount * 12) / 52;
    if (unit.startsWith('d')) return (amount * 12) / 365;
    return amount;
}

/**
 * @param {number|null} months
 * @param {string} key One of the DURATION_BUCKETS keys.
 * @returns {boolean}
 */
function isInDurationBucket(months, key) {
    const bucket = DURATION_BUCKETS.find(b => b.key === key);
    if (!bucket || months === null) return false;
    return months > bucket.min && months <= bucket.max;
}

/**
 * Parses URL query parameters and constructs Mongoose query, sort options, and clean state object.
 * @param {Object} query - req.query object from Express
 * @returns {Object} { filterObj, sortObj, state, page, limit }
 */
function parseInternshipQuery(query = {}) {
    const search = (query.search || query.q || '').trim();
    const sector = (query.sector || '').trim();
    const location = (query.location || '').trim();
    const status = (query.status || query.filter || 'all').trim(); // 'all', 'active', 'paused'
    const sort = (query.sort || 'latest').trim();
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT);

    const skills = parseList(query.skills);
    const validDurations = new Set(DURATION_BUCKETS.map(b => b.key));
    const duration = parseList(query.duration).filter(key => validDurations.has(key));

    let minStipend = parseAmount(query.minStipend);
    let maxStipend = parseAmount(query.maxStipend);
    // Someone typing the range backwards still means the same range.
    if (minStipend !== null && maxStipend !== null && minStipend > maxStipend) {
        [minStipend, maxStipend] = [maxStipend, minStipend];
    }

    const conditions = [];

    // 1. Status / Active / Paused filter (Draft listings are NEVER public)
    if (status === 'active') {
        conditions.push({
            status: { $nin: ['draft', 'paused'] },
            isPaused: { $ne: true }
        });
    } else if (status === 'paused') {
        conditions.push({
            $or: [{ status: 'paused' }, { isPaused: true }]
        });
    } else {
        // 'all' or default: omit drafts
        conditions.push({ status: { $ne: 'draft' } });
    }

    // 2. Text search matching title, companyName, sector, or requiredSkills
    if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        conditions.push({
            $or: [
                { title: searchRegex },
                { companyName: searchRegex },
                { sector: searchRegex },
                { requiredSkills: searchRegex }
            ]
        });
    }

    // 3. Sector filter
    if (sector && sector !== 'all') {
        conditions.push({ sector: new RegExp(`^${escapeRegex(sector)}$`, 'i') });
    }

    // 4. Location filter (district or state)
    if (location) {
        const locRegex = new RegExp(escapeRegex(location), 'i');
        conditions.push({
            $or: [
                { 'location.district': locRegex },
                { 'location.state': locRegex },
                { location: locRegex }
            ]
        });
    }

    // 5. Skills filter: the listing asks for at least one of the chosen skills.
    // OR within a category and AND across categories, like most job boards.
    if (skills.length) {
        conditions.push({
            requiredSkills: { $in: skills.map(skill => new RegExp(`^${escapeRegex(skill)}$`, 'i')) }
        });
    }

    // 6. Stipend range, either end optional
    if (minStipend !== null || maxStipend !== null) {
        const range = {};
        if (minStipend !== null) range.$gte = minStipend;
        if (maxStipend !== null) range.$lte = maxStipend;
        conditions.push({ monthlyStipend: range });
    }

    // Duration is not added here. It is free text, so it cannot be range
    // matched in the query itself; applyDurationFilter handles it.

    // Conjunction of all criteria: guarantees search AND location AND sector AND status work correctly together
    const filterObj = conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Sort order
    let sortObj = { _id: -1 };
    if (sort === 'stipend_high') {
        sortObj = { monthlyStipend: -1, _id: -1 };
    } else if (sort === 'stipend_low') {
        sortObj = { monthlyStipend: 1, _id: -1 };
    } else if (sort === 'vacancies') {
        sortObj = { vacancies: -1, _id: -1 };
    } else {
        sortObj = { createdAt: -1, _id: -1 };
    }

    // Stipend is kept as a string in state because buildQueryString drops the
    // number 1 (it treats it as the default page).
    const state = {
        search,
        sector,
        location,
        status,
        sort,
        page,
        limit,
        skills,
        minStipend: minStipend === null ? '' : String(minStipend),
        maxStipend: maxStipend === null ? '' : String(maxStipend),
        duration
    };

    return { filterObj, sortObj, state, page, limit };
}

/**
 * Generates an array of page numbers and ellipsis strings for pagination navigation.
 * Uses a symmetric window algorithm with ellipses when totalPages > 7.
 *
 * @param {number} currentPage - Currently active page (1-indexed)
 * @param {number} totalPages - Total number of pages
 * @returns {Array<number|string>} Array of page numbers and '...' strings
 */
function getPaginationRange(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
        return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
        return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

/**
 * Calculates pagination metadata.
 * @param {number} totalItems
 * @param {number} currentPage
 * @param {number} limit
 * @returns {Object} pagination object
 */
function buildPaginationData(totalItems, currentPage, limit = DEFAULT_LIMIT) {
    const validTotal = Math.max(0, parseInt(totalItems, 10) || 0);
    const validLimit = Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT);
    const totalPages = Math.max(1, Math.ceil(validTotal / validLimit));
    const page = Math.max(1, Math.min(parseInt(currentPage, 10) || 1, totalPages));
    const skip = (page - 1) * validLimit;
    const startItem = validTotal === 0 ? 0 : skip + 1;
    const endItem = Math.min(skip + validLimit, validTotal);

    return {
        totalItems: validTotal,
        totalPages,
        currentPage: page,
        limit: validLimit,
        skip,
        startItem,
        endItem,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        pages: getPaginationRange(page, totalPages)
    };
}

/**
 * Builds a URL query string preserving active parameters while overriding specific keys.
 * @param {Object} currentParams - Existing query state
 * @param {Object} overrides - Key/value pairs to update or set
 * @returns {string} URL query string (e.g. "?search=dev&page=2")
 */
function buildQueryString(currentParams = {}, overrides = {}) {
    const params = new URLSearchParams();
    const merged = { ...currentParams, ...overrides };

    Object.keys(merged).forEach(key => {
        let val = merged[key];
        // Multi-value filters travel as one comma separated param.
        if (Array.isArray(val)) {
            if (!val.length) return;
            val = val.join(',');
        }
        if (
            val !== undefined &&
            val !== null &&
            val !== '' &&
            !(key === 'page' && Number(val) <= 1) &&
            !(key === 'sort' && val === 'latest') &&
            !(key === 'sector' && val === 'all') &&
            !(key === 'status' && val === 'all') &&
            !(key === 'limit' && Number(val) === DEFAULT_LIMIT)
        ) {
            params.set(key, val);
        }
    });

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '/internships';
}

/**
 * Narrows a listing query to the chosen duration buckets.
 *
 * Duration is free text, so MongoDB cannot range match it directly. This
 * fetches only the _id and duration of listings that already pass every other
 * filter, parses the durations, and adds an _id condition. Counting and
 * pagination keep working because the result is still an ordinary filter.
 *
 * @param {Object} filterObj Filter from parseInternshipQuery.
 * @param {string[]} durationKeys state.duration
 * @param {import('mongoose').Model} Model The Internship model, passed in to keep this file free of model imports.
 * @returns {Promise<Object>} The same filter when no duration is chosen, otherwise a narrowed copy.
 */
async function applyDurationFilter(filterObj, durationKeys, Model) {
    if (!Array.isArray(durationKeys) || !durationKeys.length) return filterObj;

    const docs = await Model.find(filterObj).select('_id duration').lean();
    const ids = docs
        .filter(doc => {
            const months = parseDurationMonths(doc.duration);
            return durationKeys.some(key => isInDurationBucket(months, key));
        })
        .map(doc => doc._id);

    return { $and: [filterObj, { _id: { $in: ids } }] };
}

/**
 * Formats a stipend range for a filter chip.
 * @param {string} min
 * @param {string} max
 * @returns {string}
 */
function formatStipendRange(min, max) {
    const rupees = value => '₹' + Number(value).toLocaleString('en-IN');
    if (min && max) return `${rupees(min)} – ${rupees(max)}`;
    if (min) return `${rupees(min)}+`;
    return `Up to ${rupees(max)}`;
}

/**
 * Describes every active filter as a removable chip.
 *
 * Search, sort and the status tabs are left out on purpose: the issue treats
 * those as separate from filters, and each already has its own control.
 *
 * @param {Object} state The state returned by parseInternshipQuery.
 * @returns {Array<{key: string, label: string, href: string}>} One chip per value.
 *   A chip's href is the current URL with only that value removed.
 */
function getActiveFilters(state = {}) {
    const base = { ...state, page: 1 };
    const chips = [];

    if (state.sector && state.sector !== 'all') {
        chips.push({ key: 'sector', label: `Industry: ${state.sector}`, href: buildQueryString(base, { sector: '' }) });
    }
    if (state.location) {
        chips.push({ key: 'location', label: `Location: ${state.location}`, href: buildQueryString(base, { location: '' }) });
    }
    (state.skills || []).forEach(skill => {
        chips.push({
            key: 'skills',
            label: `Skill: ${skill}`,
            href: buildQueryString(base, { skills: state.skills.filter(s => s !== skill) })
        });
    });
    if (state.minStipend || state.maxStipend) {
        chips.push({
            key: 'stipend',
            label: `Stipend: ${formatStipendRange(state.minStipend, state.maxStipend)}`,
            href: buildQueryString(base, { minStipend: '', maxStipend: '' })
        });
    }
    (state.duration || []).forEach(key => {
        const bucket = DURATION_BUCKETS.find(b => b.key === key);
        if (!bucket) return;
        chips.push({
            key: 'duration',
            label: `Duration: ${bucket.label}`,
            href: buildQueryString(base, { duration: state.duration.filter(d => d !== key) })
        });
    });

    return chips;
}

/**
 * URL for "Clear all": drops every filter but keeps search, sort and the
 * status tab, since those are not filters.
 *
 * @param {Object} state
 * @returns {string}
 */
function clearFiltersHref(state = {}) {
    return buildQueryString(state, {
        sector: '',
        location: '',
        skills: [],
        minStipend: '',
        maxStipend: '',
        duration: [],
        page: 1
    });
}

/**
 * Dedupes filter options case-insensitively and sorts them, so "react" and
 * "React" typed on two listings show up as one checkbox.
 *
 * @param {Array<*>} values
 * @returns {string[]}
 */
function uniqueSortedOptions(values = []) {
    const seen = new Map();
    values.forEach(value => {
        if (typeof value !== 'string') return;
        const clean = value.trim();
        const key = clean.toLowerCase();
        if (clean && !seen.has(key)) seen.set(key, clean);
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

module.exports = {
    DEFAULT_LIMIT,
    escapeRegex,
    parseInternshipQuery,
    getPaginationRange,
    buildPaginationData,
    buildQueryString,
    DURATION_BUCKETS,
    parseList,
    parseAmount,
    parseDurationMonths,
    isInDurationBucket,
    applyDurationFilter,
    getActiveFilters,
    clearFiltersHref,
    uniqueSortedOptions
};
