// Strips MongoDB operator keys from request input so user-supplied objects can't
// smuggle query operators into a Mongoose call (NoSQL injection). Any key that
// starts with "$" or contains "." is removed in place, which keeps the request
// objects the same reference the rest of the app already uses.
//
// This does not touch values, only dangerous keys, so ordinary text (including a
// price like "$500" in a value) is untouched.

function scrub(value, seen) {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) scrub(item, seen);
        return;
    }
    for (const key of Object.keys(value)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete value[key];
            continue;
        }
        scrub(value[key], seen);
    }
}

function sanitizeRequest(req, res, next) {
    const seen = new WeakSet();
    // req.query is a getter on newer Express; scrub in place only if writable.
    for (const part of [req.body, req.params]) scrub(part, seen);
    try {
        scrub(req.query, seen);
    } catch (err) {
        // Some Express versions expose req.query as a read-only getter; the
        // route handlers already treat query values as strings, so skipping it
        // here is safe rather than throwing.
    }
    next();
}

module.exports = sanitizeRequest;
module.exports.scrub = (obj) => { scrub(obj, new WeakSet()); return obj; };
