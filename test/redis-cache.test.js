const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');

// These tests never talk to a real Redis.
delete process.env.REDIS_URL;

const { createCache } = require('../utils/cache');
const { createRunOnceCron } = require('../utils/runOnceCron');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const quiet = { warn() {}, info() {} };

// Enough of a node-redis client for the cache: get, set (with EX and NX), del and the ready state.
// Several caches can share one FakeRedis, like app instances sharing one Redis server.
class FakeRedis extends EventEmitter {
    constructor({ ready = true } = {}) {
        super();
        this.isReady = ready;
        this.data = new Map();
        this.calls = [];
        this.failWith = null;
        this.hang = false;
    }

    run(name, fn) {
        this.calls.push(name);
        if (this.hang) return new Promise(() => {});
        if (this.failWith) return Promise.reject(this.failWith);
        return Promise.resolve().then(fn);
    }

    live(key) {
        const entry = this.data.get(key);
        return entry && entry.expiresAt > Date.now() ? entry : null;
    }

    get(key) {
        return this.run('get', () => (this.live(key) ? this.live(key).value : null));
    }

    set(key, value, options = {}) {
        return this.run('set', () => {
            if (options.condition === 'NX' && this.live(key)) return null;
            const seconds = options.expiration ? options.expiration.value : Infinity;
            this.data.set(key, { value, options, expiresAt: Date.now() + seconds * 1000 });
            return 'OK';
        });
    }

    del(key) {
        return this.run('del', () => (this.data.delete(key) ? 1 : 0));
    }
}

test('without Redis the cache keeps JSON copies in memory, with expiry and a size cap', async () => {
    let now = 1000;
    const cache = createCache({ now: () => now, maxEntries: 2, logger: quiet });
    assert.equal(cache.usingRedis(), false);

    const when = new Date('2026-09-27T10:00:00.000Z');
    const value = { list: [1, 2], when };
    await cache.set('a', value, 60);
    value.list.push(3);

    const copy = await cache.get('a');
    assert.deepEqual(copy.list, [1, 2], 'later changes to the original do not leak in');
    assert.ok(copy.when instanceof Date, 'dates come back as dates');
    assert.equal(copy.when.toISOString(), when.toISOString());
    copy.list.push(9);
    assert.deepEqual((await cache.get('a')).list, [1, 2], 'every read is its own copy');

    now += 60 * 1000;
    assert.equal(await cache.get('a'), null, 'expired');

    await cache.set('x', 1, 60);
    await cache.set('y', 2, 60);
    await cache.set('z', 3, 60);
    assert.equal(await cache.get('x'), null, 'the oldest entry goes once the cache is full');
    assert.equal(await cache.get('z'), 3);

    const defaultCache = require('../utils/cache');
    assert.equal(defaultCache.usingRedis(), false, 'no REDIS_URL: memory, no connection');
});

test('getOrSet loads once, shares concurrent loads and never caches a failure', async () => {
    const cache = createCache({ logger: quiet });
    let loads = 0;
    const load = async () => {
        loads += 1;
        await new Promise(resolve => setTimeout(resolve, 5));
        return { n: loads };
    };

    const [a, b] = await Promise.all([cache.getOrSet('k', 60, load), cache.getOrSet('k', 60, load)]);
    assert.equal(loads, 1, 'two requests at once, one load');
    assert.deepEqual(a, { n: 1 });
    assert.deepEqual(b, { n: 1 });
    assert.notEqual(a, b, 'each caller gets its own copy');
    assert.deepEqual(await cache.getOrSet('k', 60, load), { n: 1 });
    assert.equal(loads, 1);

    await assert.rejects(cache.getOrSet('bad', 60, async () => { throw new Error('db down'); }), /db down/);
    assert.equal(await cache.getOrSet('bad', 60, async () => 'ok'), 'ok', 'a failure is not cached');

    let emptyLoads = 0;
    const empty = async () => { emptyLoads += 1; return null; };
    assert.equal(await cache.getOrSet('none', 60, empty), null);
    await cache.getOrSet('none', 60, empty);
    assert.equal(emptyLoads, 2, 'an empty result is not cached');
});

test('with Redis, instances share values and invalidation; keys are prefixed and expire', async () => {
    const redis = new FakeRedis();
    const one = createCache({ client: redis, logger: quiet });
    const two = createCache({ client: redis, logger: quiet });
    assert.equal(one.usingRedis(), true);

    let loads = 0;
    const load = async () => { loads += 1; return [{ title: 'Frontend intern' }]; };
    assert.deepEqual(await one.getOrSet('chat:active-internships', 60, load), [{ title: 'Frontend intern' }]);
    assert.deepEqual(await two.getOrSet('chat:active-internships', 60, load), [{ title: 'Frontend intern' }]);
    assert.equal(loads, 1, 'the second instance used the shared copy');

    const stored = redis.data.get('internpilot:chat:active-internships');
    assert.ok(stored, 'keys carry the internpilot: prefix');
    assert.deepEqual(stored.options.expiration, { type: 'EX', value: 60 });

    // A company closes a listing on instance two...
    await two.del('chat:active-internships');
    // ...and instance one sees it straight away.
    assert.equal(await one.get('chat:active-internships'), null);
    await one.getOrSet('chat:active-internships', 60, load);
    assert.equal(loads, 2);
});

test('Redis being down, slow or still connecting never breaks a caller', async () => {
    const warnings = [];
    const logger = { warn: message => warnings.push(message), info() {} };
    const redis = new FakeRedis();
    const cache = createCache({ client: redis, logger, timeoutMs: 20 });
    assert.ok(redis.listenerCount('error') >= 1, 'an error listener is attached, so a dropped connection cannot crash node');

    redis.failWith = new Error('connect ECONNREFUSED 127.0.0.1:6379');
    assert.equal(await cache.getOrSet('stats', 60, async () => 42), 42);
    assert.equal(await cache.getOrSet('stats', 60, async () => 43), 43, 'nothing cached while Redis is down');
    await cache.set('x', 1, 60);
    await cache.del('x');
    assert.equal(warnings.length, 1, 'one warning per outage');
    assert.doesNotMatch(warnings[0], /redis:\/\//, 'the connection URL is never logged');

    redis.failWith = null;
    redis.hang = true;
    const started = Date.now();
    assert.equal(await cache.getOrSet('slow', 60, async () => 'fresh'), 'fresh');
    assert.ok(Date.now() - started < 1000, 'a slow Redis is given up on quickly');

    redis.hang = false;
    redis.emit('ready');
    redis.isReady = false;
    const callsBefore = redis.calls.length;
    assert.equal(await cache.getOrSet('local', 60, async () => 'memory'), 'memory');
    assert.equal(await cache.get('local'), 'memory', 'while reconnecting, this server keeps its own copy');
    assert.equal(redis.calls.length, callsBefore, 'no Redis calls while it is not ready');

    redis.emit('error', new Error('Socket closed unexpectedly'));
    assert.equal(warnings.length, 2, 'a new outage is reported again');
});

test('claim gives a run to exactly one instance, and fails open without Redis', async () => {
    const redis = new FakeRedis();
    const one = createCache({ client: redis, logger: quiet });
    const two = createCache({ client: redis, logger: quiet });

    const results = await Promise.all([one.claim('cron:job:t1', 600), two.claim('cron:job:t1', 600)]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(redis.data.get('internpilot:cron:job:t1').options.expiration.value, 600);
    assert.equal(await two.claim('cron:job:t2', 600), true, 'the next run is a new lock');

    assert.equal(await createCache({ logger: quiet }).claim('cron:job:t1', 600), true, 'no Redis: every instance runs, as before');

    redis.failWith = new Error('down');
    assert.equal(await one.claim('cron:job:t3', 600), true, 'Redis errors fail open');

    const connecting = new FakeRedis({ ready: false });
    const waiting = createCache({ client: connecting, logger: quiet });
    const pending = waiting.claim('cron:job:t4', 600, { waitMs: 500 });
    setTimeout(() => { connecting.isReady = true; connecting.emit('ready'); }, 10);
    assert.equal(await pending, true);
    assert.ok(connecting.data.has('internpilot:cron:job:t4'), 'waited for the connection, then took the lock');

    const never = createCache({ client: new FakeRedis({ ready: false }), logger: quiet });
    assert.equal(await never.claim('cron:job:t5', 600, { waitMs: 20 }), true, 'gives up waiting and runs');
});

test('scheduled jobs run once per planned run across instances', async () => {
    const redis = new FakeRedis();
    const scheduled = [];
    const fakeCron = {
        schedule: (expression, fn, options) => { scheduled.push({ expression, fn, options }); return { expression }; },
        validate: () => true
    };
    const runs = [];
    const job = async context => { runs.push(context.date.toISOString()); };

    // Two app instances start the same scheduler code.
    const instanceA = createRunOnceCron({ cron: fakeCron, store: createCache({ client: redis, logger: quiet }) });
    const instanceB = createRunOnceCron({ cron: fakeCron, store: createCache({ client: redis, logger: quiet }) });
    assert.deepEqual(instanceA.schedule('*/5 * * * *', job, { timezone: 'Asia/Kolkata' }), { expression: '*/5 * * * *' });
    instanceB.schedule('*/5 * * * *', job, { timezone: 'Asia/Kolkata' });
    assert.deepEqual(scheduled[0].options, { timezone: 'Asia/Kolkata' }, 'options are passed through');
    assert.equal(typeof instanceA.validate, 'function', 'the rest of node-cron is still there');

    const tick = iso => ({ date: new Date(iso), triggeredAt: new Date() });
    await Promise.all([scheduled[0].fn(tick('2026-09-27T18:30:00.000Z')), scheduled[1].fn(tick('2026-09-27T18:30:00.000Z'))]);
    assert.deepEqual(runs, ['2026-09-27T18:30:00.000Z'], 'one run for two instances');
    await Promise.all([scheduled[0].fn(tick('2026-09-27T18:35:00.000Z')), scheduled[1].fn(tick('2026-09-27T18:35:00.000Z'))]);
    assert.equal(runs.length, 2, 'the next planned run happens again');

    // Another job at the same time is never blocked by the first one.
    const digests = [];
    instanceA.schedule('*/5 * * * *', async () => { digests.push('sent'); });
    await scheduled[2].fn(tick('2026-09-27T18:35:00.000Z'));
    assert.deepEqual(digests, ['sent']);

    // Without Redis every instance runs the job, exactly as before.
    const solo = [];
    const plain = createRunOnceCron({ cron: fakeCron, store: createCache({ logger: quiet }) });
    plain.schedule('0 9 * * *', async () => { solo.push(1); });
    await scheduled[3].fn(tick('2026-09-27T03:30:00.000Z'));
    await scheduled[3].fn(tick('2026-09-27T03:30:00.000Z'));
    assert.equal(solo.length, 2);
});

test('AI answers are reused for the same input only, and failures are not cached', async () => {
    const aiClient = require('../utils/aiClient');
    const originalGenerate = aiClient.generateJsonWithRetry;
    const originalCache = aiClient.cache;
    const originalModel = process.env.GEMINI_MODEL;
    const redis = new FakeRedis();
    const calls = [];
    try {
        delete process.env.GEMINI_MODEL;
        aiClient.cache = createCache({ client: redis, logger: quiet });
        aiClient.generateJsonWithRetry = async prompt => {
            calls.push(prompt);
            if (prompt === 'fails once' && calls.filter(p => p === prompt).length === 1) throw new Error('503 overloaded');
            return { skills: ['Node.js'], from: prompt };
        };
        const schema = { type: 'object' };

        assert.deepEqual(await aiClient.generateJsonCached('resume A', schema, ['skills']), { skills: ['Node.js'], from: 'resume A' });
        assert.deepEqual(await aiClient.generateJsonCached('resume A', schema, ['skills']), { skills: ['Node.js'], from: 'resume A' });
        assert.equal(calls.length, 1, 'same resume: one Gemini call');

        await aiClient.generateJsonCached('resume B', schema, ['skills']);
        await aiClient.generateJsonCached('resume A', { type: 'object', required: ['skills'] }, ['skills']);
        assert.equal(calls.length, 3, 'a different resume or schema is a new call');

        process.env.GEMINI_MODEL = 'gemini-2.5-pro';
        await aiClient.generateJsonCached('resume A', schema, ['skills']);
        assert.equal(calls.length, 4, 'a different model is a new call');

        await assert.rejects(aiClient.generateJsonCached('fails once', schema), /503/);
        await aiClient.generateJsonCached('fails once', schema);
        assert.equal(calls.filter(p => p === 'fails once').length, 2, 'a failed call is not cached');

        for (const key of redis.data.keys()) {
            assert.match(key, /^internpilot:ai:[0-9a-f]{64}$/, 'keys are hashes, no resume text');
            assert.equal(redis.data.get(key).options.expiration.value, 24 * 60 * 60);
        }
    } finally {
        aiClient.generateJsonWithRetry = originalGenerate;
        aiClient.cache = originalCache;
        if (originalModel === undefined) delete process.env.GEMINI_MODEL;
        else process.env.GEMINI_MODEL = originalModel;
    }
});

test('the app uses the shared cache where it helps, and only there', () => {
    const scheduler = read('utils/scheduler.js');
    assert.match(scheduler, /require\('\.\/runOnceCron'\)/);
    assert.doesNotMatch(scheduler, /require\('node-cron'\)/);

    const chat = read('routes/chat.js');
    assert.match(chat, /cache\.getOrSet\(CHAT_CACHE_KEY, CHAT_CACHE_SECONDS/);
    assert.match(chat, /cache\.del\(CHAT_CACHE_KEY\)/);
    assert.doesNotMatch(chat, /cachedInternships|lastInternshipsFetchTime/, 'no per-process copy left behind');
    assert.match(chat, /router\.invalidateChatCache = invalidateChatCache/, 'callers keep using the same function');

    const analytics = read('routes/analytics.js');
    assert.match(analytics, /cache\.getOrSet\(LANDING_STATS_KEY, LANDING_STATS_SECONDS/);
    assert.doesNotMatch(analytics, /cachedStats/);

    const problems = read('routes/problems.js');
    assert.match(problems, /generateJsonCached\(prompt, extractionSchema/, 'resume extraction is cached');
    assert.match(problems, /generateJsonWithRetry\(prompt, problemGenerationSchema\)/, 'new problem sets stay fresh');
    assert.doesNotMatch(read('routes/interview.js'), /generateJsonCached/, 'interview turns stay fresh');

    assert.match(read('package.json'), /"redis": "\^6\.\d+\.\d+"/);
});
