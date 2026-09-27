const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const { validatePassword, MIN_LENGTH } = require('../utils/security/passwordPolicy');
const sanitizeRequest = require('../middleware/sanitizeRequest');
const securityHeaders = require('../middleware/securityHeaders');
const csrfOrigin = require('../middleware/csrfOrigin');
const { rateLimit } = require('../utils/security/rateLimiter');

// --- small Express test doubles ---

function fakeReq({ method = 'GET', headers = {}, body = {}, query = {}, params = {}, user, xhr = false, ip = '10.0.0.1' } = {}) {
    const lower = {};
    for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
    return {
        method, body, query, params, user, xhr, ip,
        flashed: [],
        get(h) { return lower[String(h).toLowerCase()]; },
        flash(type, msg) { this.flashed.push([type, msg]); }
    };
}

function fakeRes() {
    return {
        headers: {}, statusCode: 200, ended: false,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
        set(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(o) { this.body = o; this.ended = true; return this; },
        redirect(u) { this.redirected = u; this.ended = true; return this; },
        send(h) { this.body = h; this.ended = true; return this; }
    };
}

const run = (mw, req, res) => new Promise(resolve => { mw(req, res, () => resolve('next')); setTimeout(() => resolve(res.ended ? 'ended' : 'pending'), 20); });

// --- password policy ---

test('password policy rejects short, common and email-matching passwords', () => {
    assert.equal(MIN_LENGTH, 8);
    assert.match(validatePassword('short', 'a@b.com'), /at least 8/);
    assert.match(validatePassword('password123', 'a@b.com'), /too common/);
    assert.match(validatePassword('rahul@example.com', 'rahul@example.com'), /not be the same as your email/);
    assert.match(validatePassword('rahul123', 'rahul123@example.com'), /not be the same as your email/);
    assert.equal(validatePassword('Str0ng-passphrase!', 'rahul@example.com'), null);
});

// --- input sanitizer ---

test('sanitizer strips operator and dotted keys but keeps values', () => {
    const body = { email: 'a@b.com', password: { $ne: null }, 'a.b': 1, nested: { $gt: '', ok: '$500' }, list: [{ $where: 'x' }, { fine: 1 }] };
    sanitizeRequest.scrub(body);
    assert.deepEqual(body.password, {});
    assert.equal(body['a.b'], undefined);
    assert.equal(body.nested.$gt, undefined);
    assert.equal(body.nested.ok, '$500', 'values are never touched');
    assert.equal(body.list[0].$where, undefined);
    assert.equal(body.list[1].fine, 1);
    assert.equal(body.email, 'a@b.com');
});

test('sanitizer middleware cleans req.body in place', async () => {
    const req = fakeReq({ method: 'POST', body: { email: { $gt: '' } }, params: {}, query: {} });
    const res = fakeRes();
    assert.equal(await run(sanitizeRequest, req, res), 'next');
    assert.deepEqual(req.body.email, {});
});

// --- security headers ---

test('security headers are set, with HSTS only in production', () => {
    const dev = fakeRes();
    securityHeaders(false)(fakeReq(), dev, () => {});
    assert.equal(dev.headers['x-content-type-options'], 'nosniff');
    assert.equal(dev.headers['x-frame-options'], 'SAMEORIGIN');
    assert.match(dev.headers['content-security-policy'], /frame-ancestors 'self'/);
    assert.match(dev.headers['referrer-policy'], /strict-origin/);
    assert.match(dev.headers['permissions-policy'], /camera=\(self\)/);
    assert.equal(dev.headers['strict-transport-security'], undefined);

    const prod = fakeRes();
    securityHeaders(true)(fakeReq(), prod, () => {});
    assert.match(prod.headers['strict-transport-security'], /max-age=\d+/);
});

// --- CSRF origin ---

test('CSRF guard lets safe and same-origin requests through, blocks cross-site', async () => {
    // GET is always allowed
    assert.equal(await run(csrfOrigin, fakeReq({ method: 'GET' }), fakeRes()), 'next');
    // same-origin POST allowed
    assert.equal(await run(csrfOrigin, fakeReq({ method: 'POST', headers: { host: 'internpilot.app', origin: 'https://internpilot.app' } }), fakeRes()), 'next');
    // no origin/referer at all -> allowed (SameSite cookie is the backstop)
    assert.equal(await run(csrfOrigin, fakeReq({ method: 'POST', headers: { host: 'internpilot.app' } }), fakeRes()), 'next');
    // cross-site POST -> redirected away
    const res = fakeRes();
    const req = fakeReq({ method: 'POST', headers: { host: 'internpilot.app', origin: 'https://evil.example' } });
    assert.equal(await run(csrfOrigin, req, res), 'ended');
    assert.equal(res.redirected, '/');
    assert.equal(req.flashed[0][0], 'error_msg');
    // cross-site XHR -> 403 json
    const res2 = fakeRes();
    await run(csrfOrigin, fakeReq({ method: 'POST', xhr: true, headers: { host: 'internpilot.app', origin: 'https://evil.example' } }), res2);
    assert.equal(res2.statusCode, 403);
});

// --- rate limiter (with a stubbed MongoDB collection) ---

function stubStore() {
    const docs = new Map();
    const coll = {
        async createIndex() { return 'ok'; },
        async findOneAndUpdate(filter, update) {
            let doc = docs.get(filter._id);
            if (!doc) { doc = { _id: filter._id, count: 0, ...(update.$setOnInsert || {}) }; docs.set(filter._id, doc); }
            doc.count += (update.$inc && update.$inc.count) || 0;
            return { ...doc };
        }
    };
    const orig = mongoose.connection.collection;
    mongoose.connection.collection = () => coll;
    return { restore() { mongoose.connection.collection = orig; }, coll };
}

test('rate limiter allows up to the max, then returns 429 with Retry-After', async () => {
    const store = stubStore();
    try {
        const mw = rateLimit({ name: 'test-login', windowMs: 60 * 1000, max: 2, by: 'ip', json: true });
        const req = () => fakeReq({ method: 'POST', ip: '1.2.3.4' });
        assert.equal(await run(mw, req(), fakeRes()), 'next');
        assert.equal(await run(mw, req(), fakeRes()), 'next');
        const res = fakeRes();
        await run(mw, req(), res);
        assert.equal(res.statusCode, 429);
        assert.ok(Number(res.headers['retry-after']) >= 1);
        assert.match(res.body.error, /try again/i);
    } finally {
        store.restore();
    }
});

test('rate limiter keys separately by IP so other users are unaffected', async () => {
    const store = stubStore();
    try {
        const mw = rateLimit({ name: 'test-sep', windowMs: 60 * 1000, max: 1, by: 'ip', json: true });
        await run(mw, fakeReq({ method: 'POST', ip: 'A' }), fakeRes()); // uses A's budget
        const blockedA = fakeRes();
        await run(mw, fakeReq({ method: 'POST', ip: 'A' }), blockedA);
        assert.equal(blockedA.statusCode, 429);
        // A different IP still has its own budget
        assert.equal(await run(mw, fakeReq({ method: 'POST', ip: 'B' }), fakeRes()), 'next');
    } finally {
        store.restore();
    }
});

test('rate limiter fails open when the store is unavailable', async () => {
    const orig = mongoose.connection.collection;
    mongoose.connection.collection = () => ({ createIndex: async () => 'ok', findOneAndUpdate: async () => { throw new Error('db down'); } });
    try {
        const mw = rateLimit({ name: 'test-failopen', windowMs: 1000, max: 1, by: 'ip', json: true });
        assert.equal(await run(mw, fakeReq({ method: 'POST', ip: 'x' }), fakeRes()), 'next', 'request is allowed when the limiter store errors');
    } finally {
        mongoose.connection.collection = orig;
    }
});

// --- wiring: the app and auth actually use the new protections ---

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('app.js wires the security middleware and hides the framework header', () => {
    const app = read('app.js');
    assert.match(app, /app\.disable\('x-powered-by'\)/);
    assert.match(app, /middleware\/securityHeaders/);
    assert.match(app, /middleware\/sanitizeRequest/);
    assert.match(app, /middleware\/csrfOrigin/);
});

test('auth uses rate limits, OTP lockout, the password policy and no enumeration', () => {
    const auth = read('routes/auth.js');
    assert.match(auth, /rateLimit/);
    assert.match(auth, /loginLimiter/);
    assert.match(auth, /OTP_MAX_ATTEMPTS/);
    assert.match(auth, /validatePassword/);
    // The old enumerating messages are gone.
    assert.doesNotMatch(auth, /No account found with that email address/);
    assert.doesNotMatch(auth, /User not found\. Please register first/);
    assert.doesNotMatch(auth, /Password must be at least 6 characters/);
    const passport = read('config/passport.js');
    assert.doesNotMatch(passport, /Email not registered/);
    assert.match(passport, /Incorrect email or password/);
});
