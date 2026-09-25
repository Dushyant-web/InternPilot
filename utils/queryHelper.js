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
    const limit = Math.max(1, parseInt(query.limit, 10) || 6);

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

    const state = { search, sector, location, status, sort, page, limit };

    return { filterObj, sortObj, state, page, limit };
}

/**
 * Calculates pagination metadata.
 * @param {number} totalItems
 * @param {number} currentPage
 * @param {number} limit
 * @returns {Object} pagination object
 */
function buildPaginationData(totalItems, currentPage, limit) {
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const page = Math.min(currentPage, totalPages);
    const skip = (page - 1) * limit;

    return {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
        skip,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
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
        const val = merged[key];
        if (
            val !== undefined &&
            val !== null &&
            val !== '' &&
            val !== 1 &&
            !(key === 'sort' && val === 'latest') &&
            !(key === 'sector' && val === 'all') &&
            !(key === 'status' && val === 'all')
        ) {
            // Omit page if 1
            if (key === 'page' && Number(val) <= 1) return;
            params.set(key, val);
        }
    });

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '/internships';
}

module.exports = {
    escapeRegex,
    parseInternshipQuery,
    buildPaginationData,
    buildQueryString
};
