const mongoose = require('mongoose');

// A small fixed-window rate limiter backed by MongoDB, so the counters survive
// a restart and are shared across instances. No new npm package, and it uses
// the app's existing Mongoose connection (like utils/sessionStore.js).
//
// Every limiter fails OPEN: if the database is briefly unavailable the request
// is allowed through rather than the whole site returning errors. Rate limiting
// is a guard, not something worth taking the app down for.

const COLLECTION = 'rate_limits';
let indexReady = null;

function collection(connection = mongoose.connection) {
    return connection.collection(COLLECTION);
}

// A TTL index removes each window's counter once it has expired, so the
// collection never grows without bound.
function ensureIndex(connection) {
    if (!indexReady) {
        indexReady = Promise.resolve(collection(connection).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }))
            .catch(err => { indexReady = null; throw err; });
    }
    return indexReady;
}

const clientIp = req => (req.ip || req.connection?.remoteAddress || 'unknown');

/**
 * Records one hit against `key` in the current window and returns
 * { limited, remaining, retryAfterSeconds, count }.
 */
async function hit(key, windowMs, max, connection = mongoose.connection) {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;
    const id = `${key}:${windowStart}`;

    await ensureIndex(connection);
    const doc = await collection(connection).findOneAndUpdate(
        { _id: id },
        {
            $inc: { count: 1 },
            // A little grace on the TTL so a counter is never dropped mid-window.
            $setOnInsert: { expiresAt: new Date(windowEnd + 60 * 1000) }
        },
        { upsert: true, returnDocument: 'after' }
    );
    const count = (doc && (doc.value ? doc.value.count : doc.count)) || 1;
    return {
        count,
        limited: count > max,
        remaining: Math.max(0, max - count),
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000))
    };
}

/**
 * Builds an Express middleware that limits requests.
 *
 *   name       label used in the counter key (e.g. 'login')
 *   windowMs   size of the window
 *   max        allowed hits per window per key
 *   by         'ip' | 'user' | 'ip+user' | 'ip+email' | function(req) -> string
 *   json       respond with 429 JSON instead of a flash + redirect
 *   message    shown to the user when limited
 *   redirectTo function(req) -> path used for the flash + redirect response
 */
function rateLimit({
    name,
    windowMs,
    max,
    by = 'ip',
    json = false,
    message = 'Too many requests. Please wait a moment and try again.',
    redirectTo
} = {}) {
    const bucketKey = req => {
        if (typeof by === 'function') return by(req) || 'unknown';
        const email = String(req.body?.email || '').trim().toLowerCase();
        const user = req.user?._id ? String(req.user._id) : '';
        switch (by) {
            case 'user': return user || clientIp(req);
            case 'ip+user': return `${clientIp(req)}|${user}`;
            case 'ip+email': return `${clientIp(req)}|${email}`;
            case 'ip':
            default: return clientIp(req);
        }
    };

    return async function rateLimiter(req, res, next) {
        let result;
        try {
            result = await hit(`${name}:${bucketKey(req)}`, windowMs, max);
        } catch (err) {
            // Fail open: never block real users because the limiter's store is down.
            console.error(`Rate limiter "${name}" unavailable:`, err.message);
            return next();
        }
        if (!result.limited) return next();

        res.set('Retry-After', String(result.retryAfterSeconds));
        const minutes = Math.ceil(result.retryAfterSeconds / 60);
        const wait = result.retryAfterSeconds <= 90 ? `${result.retryAfterSeconds} seconds` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
        const full = `${message} You can try again in about ${wait}.`;

        if (json || req.xhr || req.get('accept')?.includes('application/json')) {
            return res.status(429).json({ error: full, retryAfter: result.retryAfterSeconds });
        }
        if (req.flash) req.flash('error_msg', full);
        const back = (redirectTo && redirectTo(req)) || req.get('Referer') || '/';
        return res.redirect(back);
    };
}

module.exports = { rateLimit, hit, ensureIndex, COLLECTION, clientIp };
