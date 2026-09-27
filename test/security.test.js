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
const { consumeOtp, sameCode, OTP_MAX_ATTEMPTS } = require('../utils/security/otpGuard');
const express = require('express');

// --- small Express test doubles ---

function fakeReq({ method = 'GET', headers = {}, body = {}, query = {}, params = {}, user, xhr = false, ip = '10.0.0.1', trustProxy = false } = {}) {
    const lower = {};
    for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
    return {
        method, body, query, params, user, xhr, ip,
        app: { get: key => (key === 'trust proxy' ? trustProxy : undefined) },
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

test('in a real Express 5 app, route handlers get the sanitized query and body', async () => {
    // Express 5 re-parses req.query on every read, so the cleaned copy has to be pinned.
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(sanitizeRequest);
    app.all('/echo', (req, res) => res.json({ query: req.query, again: req.query === req.query, body: req.body }));
    const server = app.listen(0);
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const got = await (await fetch(`${base}/echo?%24where=1&a.b=2&ok=yes`)).json();
        assert.deepEqual(got.query, { ok: 'yes' }, '$ and dotted query keys removed');
        assert.equal(got.again, true, 'every read returns the same sanitized object');

        const posted = await (await fetch(`${base}/echo`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email[$ne]=x&password=secret&price=%24500'
        })).json();
        assert.deepEqual(posted.body, { email: {}, password: 'secret', price: '$500' });
    } finally {
        server.close();
    }
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

test('CSRF guard never trusts Origin: null, and checks Referer when Origin is missing', async () => {
    const blocked = async headers => (await run(csrfOrigin, fakeReq({ method: 'POST', headers: { host: 'internpilot.app', ...headers } }), fakeRes())) === 'ended';
    // Sandboxed iframes and data: pages send Origin: null, often with no Referer.
    assert.equal(await blocked({ origin: 'null' }), true);
    assert.equal(await blocked({ origin: 'null', referer: 'https://internpilot.app/profile' }), true, 'an Origin header is decisive');
    assert.equal(await blocked({ origin: '' }), true);
    // No Origin: the Referer decides.
    assert.equal(await blocked({ referer: 'https://evil.example/form' }), true);
    assert.equal(await blocked({ referer: 'https://internpilot.app/auth/login' }), false);
});

test('CSRF guard accepts the public host from a trusted proxy only', async () => {
    const headers = { host: 'internal:8080', 'x-forwarded-host': 'internpilot.app', origin: 'https://internpilot.app' };
    assert.equal(await run(csrfOrigin, fakeReq({ method: 'POST', trustProxy: 1, headers }), fakeRes()), 'next');
    assert.equal(await run(csrfOrigin, fakeReq({ method: 'POST', trustProxy: false, headers }), fakeRes()), 'ended', 'ignored without trust proxy');
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

test('the per-account sign-in limit is shared by every IP trying that email', async () => {
    const store = stubStore();
    try {
        const mw = rateLimit({ name: 'test-account', windowMs: 60 * 1000, max: 2, by: 'email', json: true });
        const attempt = ip => fakeReq({ method: 'POST', ip, body: { email: 'Victim@Example.com' } });
        assert.equal(await run(mw, attempt('1.1.1.1'), fakeRes()), 'next');
        assert.equal(await run(mw, attempt('2.2.2.2'), fakeRes()), 'next');
        const third = fakeRes();
        await run(mw, attempt('3.3.3.3'), third);
        assert.equal(third.statusCode, 429, 'a new IP does not get a fresh allowance');
        // Another account is unaffected.
        assert.equal(await run(mw, fakeReq({ method: 'POST', ip: '3.3.3.3', body: { email: 'other@example.com' } }), fakeRes()), 'next');
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

test('auth uses rate limits, the atomic OTP check, the password policy and no enumeration', () => {
    const auth = read('routes/auth.js');
    assert.match(auth, /rateLimit/);
    assert.match(auth, /router\.post\('\/login', loginAccountLimiter, loginLimiter,/);
    assert.match(auth, /by: 'email'/);
    assert.equal((auth.match(/consumeOtp\(User, email, otp/g) || []).length, 2, 'verify and reset both use the atomic check');
    assert.match(auth, /validatePassword/);
    // Messages that revealed whether an email has an account are gone.
    assert.doesNotMatch(auth, /No account found/);
    assert.doesNotMatch(auth, /Account is already verified/);
    assert.doesNotMatch(auth, /User not found\. Please register first/);
    assert.doesNotMatch(auth, /Password must be at least 6 characters/);
    const resend = auth.slice(auth.indexOf("router.post('/resend-otp'"), auth.indexOf("router.post('/login'"));
    assert.doesNotMatch(resend, /remainingSeconds|error_msg', 'Account/, 'resend gives one reply in every case');
    const passport = read('config/passport.js');
    assert.doesNotMatch(passport, /Email not registered/);
    assert.match(passport, /Incorrect email or password/);
});

// --- one-time codes: atomic attempt limit (fake model with MongoDB-like atomic updates) ---

function fakeUsers(initial) {
    const docs = initial.map((d, i) => ({ _id: `u${i}`, ...d }));
    const hooks = { afterReserve: null };
    const matches = (doc, filter) => Object.entries(filter).every(([key, cond]) => {
        const value = doc[key];
        if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
            if ('$exists' in cond && (value !== undefined) !== cond.$exists) return false;
            if ('$ne' in cond && value === cond.$ne) return false;
            if ('$gt' in cond && !(value > cond.$gt)) return false;
            if ('$not' in cond && value !== undefined && value !== null && value >= cond.$not.$gte) return false;
            return true;
        }
        return value === cond;
    });
    const apply = (doc, update) => {
        for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
        for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
        for (const k of Object.keys(update.$unset || {})) delete doc[k];
    };
    return {
        docs,
        hooks,
        calls: { reserve: 0 },
        // Each call matches and updates in one synchronous step, like MongoDB.
        async findOneAndUpdate(filter, update) {
            const doc = docs.find(d => matches(d, filter));
            if (!doc) return null;
            apply(doc, update);
            if (update.$inc) this.calls.reserve += 1;
            const copy = { ...doc };
            if (update.$inc && hooks.afterReserve) hooks.afterReserve(doc);
            return copy;
        },
        async updateOne(filter, update) {
            const doc = docs.find(d => matches(d, filter));
            if (doc) apply(doc, update);
            return { matchedCount: doc ? 1 : 0 };
        }
    };
}

const fresh = extra => ({ email: 'asha@example.com', otp: '482913', otpExpires: new Date(Date.now() + 10 * 60 * 1000), otpAttempts: 0, isEmailVerified: false, ...extra });

test('a correct code works once and is consumed', async () => {
    const Users = fakeUsers([fresh()]);
    const first = await consumeOtp(Users, 'asha@example.com', '482913', { onSuccess: { isEmailVerified: true } });
    assert.equal(first.ok, true);
    assert.equal(Users.docs[0].isEmailVerified, true);
    assert.equal(Users.docs[0].otp, undefined, 'the code is gone');
    assert.equal(Users.docs[0].otpAttempts, 0);
    assert.equal((await consumeOtp(Users, 'asha@example.com', '482913')).ok, false, 'it cannot be reused');
});

test('after five wrong codes the code is cleared, so the right one no longer works', async () => {
    const Users = fakeUsers([fresh()]);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
        assert.equal((await consumeOtp(Users, 'asha@example.com', `00000${i}`)).ok, false);
    }
    assert.equal(Users.docs[0].otp, undefined);
    assert.equal((await consumeOtp(Users, 'asha@example.com', '482913')).ok, false);
});

test('parallel guesses cannot get past the limit', async () => {
    const Users = fakeUsers([fresh()]);
    // Five wrong guesses and the right one, all sent at once. With a
    // read-then-compare check the right one could slip through; here the
    // sixth guess can't reserve an attempt, so it is never compared.
    const guesses = ['000001', '000002', '000003', '000004', '000005', '482913'];
    const results = await Promise.all(guesses.map(code => consumeOtp(Users, 'asha@example.com', code)));
    assert.deepEqual(results.map(r => r.ok), [false, false, false, false, false, false]);
    assert.equal(Users.calls.reserve, OTP_MAX_ATTEMPTS, 'only five attempts were ever reserved');
    assert.equal(Users.docs[0].isEmailVerified, false);
});

test('clearing a used-up code never wipes a newer code sent in the meantime', async () => {
    const Users = fakeUsers([fresh({ otpAttempts: OTP_MAX_ATTEMPTS - 1 })]);
    // Right after the fifth wrong guess is counted, the user asks for a new code.
    Users.hooks.afterReserve = doc => { Users.hooks.afterReserve = null; doc.otp = '715204'; doc.otpAttempts = 0; };
    assert.equal((await consumeOtp(Users, 'asha@example.com', '111111')).ok, false);
    assert.equal(Users.docs[0].otp, '715204', 'the new code survives');
    assert.equal((await consumeOtp(Users, 'asha@example.com', '715204')).ok, true);
});

test('expired codes, unknown emails and accounts without a code all fail the same way', async () => {
    const Users = fakeUsers([
        fresh({ email: 'old@example.com', otpExpires: new Date(Date.now() - 1000) }),
        { email: 'done@example.com', isEmailVerified: true },
        fresh({ email: 'legacy@example.com', otpAttempts: undefined })
    ]);
    assert.deepEqual(await consumeOtp(Users, 'old@example.com', '482913'), { ok: false });
    assert.deepEqual(await consumeOtp(Users, 'nobody@example.com', '482913'), { ok: false });
    assert.deepEqual(await consumeOtp(Users, 'done@example.com', '482913'), { ok: false });
    assert.equal(Users.docs[0].otpAttempts, 0, 'an expired code does not use up attempts');
    // Accounts created before the counter existed still work.
    assert.equal((await consumeOtp(Users, 'legacy@example.com', '482913')).ok, true);
});

test('code comparison is exact and constant-time', () => {
    assert.equal(sameCode('482913', '482913'), true);
    assert.equal(sameCode('482913', '482914'), false);
    assert.equal(sameCode('482913', '48291'), false);
    assert.equal(sameCode('', ''), false);
    assert.equal(sameCode(undefined, '482913'), false);
});
