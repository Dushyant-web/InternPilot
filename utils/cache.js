/*
 * A small cache shared by every InternPilot instance.
 *
 * With REDIS_URL set (Redis, Valkey, or a hosted service such as Upstash with a
 * rediss:// URL), all app instances share one cache: clearing a key on one
 * server clears it everywhere, and scheduled jobs can take a lock so only one
 * instance runs them (see utils/runOnceCron.js). Without REDIS_URL, each
 * process keeps a small in-memory cache, which is how InternPilot has always
 * worked.
 *
 * The cache must never break a page. When Redis is down or slow, reads miss,
 * writes are skipped and getOrSet() simply computes the value; nothing waits
 * longer than a short timeout. Values are stored as JSON in both modes, so code
 * behaves the same with and without Redis (ISO dates come back as Date objects).
 */
const crypto = require('crypto');

const KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'internpilot:';
const TIMEOUT_MS = 500;
const LOCK_WAIT_MS = 2000;
const MEMORY_MAX_ENTRIES = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const serialize = value => JSON.stringify(value);
const deserialize = text => JSON.parse(text, (key, value) => (
    typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value
));

/** A short, stable key for any JSON input, such as an AI prompt. */
function hashKey(...parts) {
    return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis did not answer within ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Resolves true once the client is ready, or false after `ms`. */
function whenReady(client, ms) {
    if (client.isReady) return Promise.resolve(true);
    return new Promise(resolve => {
        const onReady = () => finish(true);
        const timer = setTimeout(() => finish(false), ms);
        function finish(ready) {
            clearTimeout(timer);
            client.removeListener('ready', onReady);
            resolve(ready);
        }
        client.once('ready', onReady);
    });
}

/** The per-process fallback: a size-capped map of JSON strings with expiry. */
function createMemoryStore({ now, maxEntries }) {
    const entries = new Map();
    return {
        get(key) {
            const entry = entries.get(key);
            if (!entry) return null;
            if (entry.expiresAt <= now()) {
                entries.delete(key);
                return null;
            }
            return entry.text;
        },
        set(key, text, ttlSeconds) {
            entries.delete(key);
            entries.set(key, { text, expiresAt: now() + ttlSeconds * 1000 });
            // Once full, the oldest entries go first.
            while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        },
        del(key) {
            entries.delete(key);
        }
    };
}

function createCache({
    client = null,
    prefix = KEY_PREFIX,
    now = Date.now,
    timeoutMs = TIMEOUT_MS,
    maxEntries = MEMORY_MAX_ENTRIES,
    logger = console
} = {}) {
    const memory = createMemoryStore({ now, maxEntries });
    const loading = new Map();
    let outage = false;

    const usingRedis = () => Boolean(client && client.isReady);

    // One line per outage. Only the error message is logged, never the
    // connection URL, which can hold a password.
    const reportError = err => {
        if (outage) return;
        outage = true;
        logger.warn(`[cache] Redis unavailable, using this server's memory until it's back: ${(err && err.message) || err}`);
    };

    if (client) {
        // Without an error listener, a dropped connection would crash the process.
        client.on('error', reportError);
        client.on('ready', () => {
            if (outage) logger.info('[cache] Redis is back');
            outage = false;
        });
    }

    async function readText(fullKey) {
        if (!usingRedis()) return memory.get(fullKey);
        try {
            return await withTimeout(client.get(fullKey), timeoutMs);
        } catch (err) {
            reportError(err);
            return null;
        }
    }

    async function writeText(fullKey, text, ttlSeconds) {
        if (!usingRedis()) {
            memory.set(fullKey, text, ttlSeconds);
            return;
        }
        try {
            await withTimeout(client.set(fullKey, text, { expiration: { type: 'EX', value: ttlSeconds } }), timeoutMs);
        } catch (err) {
            reportError(err);
        }
    }

    /** The cached value for `key`, or null. */
    async function get(key) {
        const text = await readText(prefix + key);
        return text == null ? null : deserialize(text);
    }

    /** Caches `value` (anything JSON can hold) for `ttlSeconds`. */
    async function set(key, value, ttlSeconds) {
        const text = serialize(value);
        if (text === undefined) return;
        await writeText(prefix + key, text, ttlSeconds);
    }

    /** Removes `key` for every instance (only this one without Redis). */
    async function del(key) {
        const fullKey = prefix + key;
        memory.del(fullKey);
        if (!usingRedis()) return;
        try {
            await withTimeout(client.del(fullKey), timeoutMs);
        } catch (err) {
            reportError(err);
        }
    }

    /**
     * The cached value for `key`, or else the result of `load()`, cached for
     * `ttlSeconds`. Concurrent misses on this instance share one load. A failed
     * load is never cached; its error goes to the caller.
     */
    async function getOrSet(key, ttlSeconds, load) {
        const fullKey = prefix + key;
        const cached = await readText(fullKey);
        if (cached != null) return deserialize(cached);

        if (!loading.has(fullKey)) {
            const pending = (async () => {
                const text = serialize(await load());
                if (text !== undefined && text !== 'null') await writeText(fullKey, text, ttlSeconds);
                return text;
            })();
            loading.set(fullKey, pending);
            pending.then(() => loading.delete(fullKey), () => loading.delete(fullKey));
        }
        const text = await loading.get(fullKey);
        // Every caller gets its own copy, the same shape as a cache hit.
        return text === undefined ? undefined : deserialize(text);
    }

    /**
     * Takes a lock that only one instance can hold for `ttlSeconds`, resolving
     * true for the instance that got it. Without Redis, or when Redis can't be
     * reached, it resolves true, so the work still happens as it did before.
     */
    async function claim(key, ttlSeconds, { waitMs = LOCK_WAIT_MS } = {}) {
        if (!client) return true;
        if (!(await whenReady(client, waitMs))) return true;
        try {
            const reply = await withTimeout(client.set(prefix + key, String(process.pid), {
                condition: 'NX',
                expiration: { type: 'EX', value: ttlSeconds }
            }), waitMs);
            return reply === 'OK';
        } catch (err) {
            reportError(err);
            return true;
        }
    }

    return { get, set, del, getOrSet, claim, usingRedis };
}

function createDefaultCache() {
    const url = process.env.REDIS_URL;
    if (!url) return createCache();

    const { createClient } = require('redis');
    const client = createClient({
        url,
        // Fail fast while disconnected instead of queueing commands until Redis is back.
        disableOfflineQueue: true,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: retries => Math.min(500 * (retries + 1), 10000)
        }
    });
    const cache = createCache({ client });
    client.connect().then(
        () => console.log('[cache] Using Redis for the shared cache'),
        () => {} // reported through the client's error event
    );
    return cache;
}

module.exports = createDefaultCache();
module.exports.createCache = createCache;
module.exports.hashKey = hashKey;
