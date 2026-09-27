// Strips MongoDB operator keys from request input so user-supplied objects can't
// smuggle query operators into a Mongoose call (NoSQL injection). Any key that
// starts with "$" or contains "." is removed, as are prototype keys.
//
// Only keys are touched, never values, so ordinary text (including a price like
// "$500") is left alone.

const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);

function scrub(value, seen) {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) scrub(item, seen);
        return;
    }
    for (const key of Object.keys(value)) {
        if (key.startsWith('$') || key.includes('.') || DANGEROUS.has(key)) {
            delete value[key];
            continue;
        }
        scrub(value[key], seen);
    }
}

function sanitizeRequest(req, res, next) {
    const seen = new WeakSet();
    scrub(req.body, seen);
    scrub(req.params, seen);

    // In Express 5 `req.query` is a getter that parses the URL again on every
    // read, so scrubbing its result would only clean a throwaway copy. Parse it
    // once, clean it, and pin the cleaned object on the request so every later
    // read (and every route handler) sees the sanitized version.
    const query = req.query;
    scrub(query, seen);
    Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });

    next();
}

module.exports = sanitizeRequest;
module.exports.scrub = (obj) => { scrub(obj, new WeakSet()); return obj; };
