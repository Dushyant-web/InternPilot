const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Internship = require('../models/Internship');
const Notification = require('../models/Notification');
const AdminAction = require('../models/AdminAction');
const AccountSuspension = require('../models/AccountSuspension');
const Announcement = require('../models/Announcement');

const analytics = require('../utils/adminAnalytics');
const risk = require('../utils/listingRisk');
const suspensions = require('../utils/suspensions');
const announcements = require('../utils/announcements');
const audit = require('../utils/adminAudit');
const directory = require('../utils/adminDirectory');

const id = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;

async function withStubs(stubs, fn) {
    const originals = stubs.map(([target, method]) => [target, method, target[method]]);
    stubs.forEach(([target, method, fake]) => { target[method] = fake; });
    try {
        return await fn();
    } finally {
        originals.forEach(([target, method, original]) => { target[method] = original; });
    }
}
// A fake for Model.findX(...).select(...).lean() style chains.
const chain = result => {
    const q = { select: () => q, sort: () => q, limit: () => q, populate: () => q, lean: async () => result };
    return q;
};
const quiet = async fn => {
    const original = console.error;
    console.error = () => {};
    try { return await fn(); } finally { console.error = original; }
};

const viewPath = name => path.join(__dirname, '..', 'views', name);
const render = (name, locals) => ejs.render(
    fs.readFileSync(viewPath(name), 'utf8').replace("<% layout('layouts/boilerplate') %>", ''),
    locals,
    { filename: viewPath(name) }
);

// --- Analytics ---

test('ranges are 7, 30 or 90 days, defaulting to 30', () => {
    assert.equal(analytics.parseRange('7'), 7);
    assert.equal(analytics.parseRange('90'), 90);
    assert.equal(analytics.parseRange('365'), 30);
    assert.equal(analytics.parseRange(undefined), 30);
});

test('a range starts at midnight India time and is compared with the same length before it', () => {
    const now = new Date('2026-09-27T10:00:00Z'); // 15:30 IST
    const b = analytics.periodBounds(7, now);
    assert.equal(b.start.toISOString(), '2026-09-20T18:30:00.000Z'); // 21 Sep 00:00 IST
    assert.equal(b.prevEnd.toISOString(), b.start.toISOString());
    assert.equal(b.start - b.prevStart, 7 * DAY);
    assert.equal(analytics.istDays(b.start, now).length, 7);
});

test('percent change handles growth, drops and nothing to compare with', () => {
    assert.equal(analytics.percentChange(10, 5), 100);
    assert.equal(analytics.percentChange(5, 10), -50);
    assert.equal(analytics.percentChange(0, 0), 0);
    assert.equal(analytics.percentChange(3, 0), null);
});

test('the funnel counts the furthest stage each application reached', () => {
    const funnel = analytics.buildFunnel([
        { status: 'Submitted', history: ['Submitted'] },
        { status: 'pending', history: [] },
        { status: 'Rejected', history: ['Submitted', 'Under Review', 'Interview', 'Rejected'] },
        { status: 'Hired', history: ['Submitted', 'Shortlisted', 'Interview', 'Hired'] },
        { status: 'Withdrawn', history: ['Submitted', 'Withdrawn'] }
    ]);
    assert.deepEqual(funnel.steps.map(s => s.reached), [5, 2, 2, 2, 1]);
    assert.equal(funnel.steps[0].conversion, null);
    assert.equal(funnel.steps[1].conversion, 40);
    assert.equal(funnel.steps[4].conversion, 50);
    assert.deepEqual(funnel.exits, { Rejected: 1, Withdrawn: 1 });
    assert.equal(analytics.buildFunnel([]).steps[1].conversion, 0);
});

test('CSV cells are quoted when needed and spreadsheet formulas are neutralised', () => {
    assert.equal(analytics.csvCell('plain'), 'plain');
    assert.equal(analytics.csvCell('a, b'), '"a, b"');
    assert.equal(analytics.csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(analytics.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(analytics.csvCell('+91 98765'), "'+91 98765");
    assert.equal(analytics.csvCell(null), '');
    const csv = analytics.toCsv([{ label: 'Name', value: 'name' }, { label: 'Twice', value: r => r.n * 2 }], [{ name: 'Asha', n: 2 }]);
    assert.equal(csv, 'Name,Twice\r\nAsha,4\r\n');
});

const sampleOverview = () => ({
    range: 30,
    rangeLabel: 'Last 30 days',
    summary: {
        cards: [
            { key: 'candidates', label: 'New candidates', value: 12, previous: 6, change: 100 },
            { key: 'companies', label: 'New companies', value: 2, previous: 0, change: null },
            { key: 'listings', label: 'New listings', value: 4, previous: 5, change: -20 },
            { key: 'applications', label: 'Applications', value: 30, previous: 30, change: 0 },
            { key: 'hires', label: 'Hires', value: 1, previous: 0, change: null }
        ],
        totals: { pendingCompanies: 3, liveListings: 9, allCandidates: 120 }
    },
    series: { labels: ['2026-09-26', '2026-09-27'], signups: [1, 2], applications: [3, 4] },
    funnel: analytics.buildFunnel([{ status: 'Hired', history: ['Submitted', 'Interview', 'Hired'] }]),
    states: [{ state: 'Maharashtra', applications: 20 }, { state: '<b>Goa</b>', applications: 2 }],
    listings: [{ id: '1', title: 'Backend Intern', company: 'Acme', status: 'published', openings: 2, applications: 10, hired: 1 }],
    skills: [{ skill: 'React', listings: 5, candidates: 2, perListing: 0.4 }],
    pmis: { eligible: 50, ineligible: 20, incomplete: 30, scanned: 100, capped: false }
});

test('the overview CSV has every section', () => {
    const csv = analytics.overviewCsv(sampleOverview());
    ['Summary', 'Funnel', 'Applications by state', 'Top listings', 'Skills gap', 'PMIS eligibility'].forEach(section => {
        assert.ok(csv.includes(section), section);
    });
});

// --- Listing risk and moderation ---

test('durations are read in months; nonsense is not', () => {
    assert.equal(risk.durationInMonths('12 Months'), 12);
    assert.equal(risk.durationInMonths('1 Year'), 12);
    assert.equal(risk.durationInMonths('3'), 3);
    assert.ok(Math.abs(risk.durationInMonths('6 weeks') - 1.38) < 0.01);
    assert.equal(risk.durationInMonths('900000000000'), null);
    assert.equal(risk.durationInMonths('whenever'), null);
});

const cleanListing = {
    title: 'Backend Developer Intern',
    description: 'Work with our platform team on REST APIs in Node.js, write tests and review pull requests with a mentor every week.',
    vacancies: 3,
    monthlyStipend: 15000,
    duration: '6 Months'
};

test('a normal listing from a verified company has no flags', () => {
    assert.deepEqual(risk.assessListing(cleanListing, { companyDetails: { isVerified: true } }), []);
    assert.equal(risk.riskLevel([]), 'none');
});

test('each kind of risk is flagged', () => {
    const ids = listing => risk.assessListing({ ...cleanListing, ...listing }).map(f => f.id);
    assert.ok(ids({ description: cleanListing.description + ' A refundable security deposit of Rs 2000 is required.' }).includes('fees'));
    assert.ok(ids({ description: cleanListing.description + ' Pay the registration fee to confirm.' }).includes('fees'));
    assert.ok(ids({ description: cleanListing.description + ' Call 9876543210.' }).includes('contact'));
    assert.ok(ids({ description: cleanListing.description + ' Join on wa.me/919876543210' }).includes('contact'));
    assert.ok(ids({ description: cleanListing.description + ' Mail hr@acme.example' }).includes('contact'));
    assert.ok(ids({ vacancies: 1e24 }).includes('openings'));
    assert.ok(ids({ monthlyStipend: 20 }).includes('stipend'));
    assert.ok(ids({ duration: '900000000000' }).includes('duration'));
    assert.ok(ids({ description: 'Good job.' }).includes('thin'));
    assert.ok(risk.assessListing(cleanListing, { companyDetails: { isVerified: false } }).some(f => f.id === 'unverified'));
    const flags = risk.assessListing({ ...cleanListing, vacancies: 1e24, description: 'Short.' });
    assert.equal(risk.riskLevel(flags), 'high');
});

const admin = { _id: id(), role: 'admin', name: 'Admin' };

test('moderation checks the action, the current status and the reason', async () => {
    const listingId = id();
    assert.match((await risk.moderateListing(admin, listingId, 'delete', 'x')).error, /Unknown action/);
    assert.match((await risk.moderateListing(admin, 'bad-id', 'pause', 'x')).error, /not found/);
    await withStubs([[Internship, 'findById', () => chain({ _id: listingId, status: 'draft', title: 'T' })]], async () => {
        assert.match((await risk.moderateListing(admin, listingId, 'pause', 'Too many complaints about fees')).error, /draft listing can't be paused/);
    });
    await withStubs([[Internship, 'findById', () => chain({ _id: listingId, status: 'published', title: 'T' })]], async () => {
        assert.match((await risk.moderateListing(admin, listingId, 'pause', 'short')).error, /at least 10 characters/);
    });
});

test('restoring needs a verified company', async () => {
    const listingId = id();
    await withStubs([
        [Internship, 'findById', () => chain({ _id: listingId, status: 'paused', title: 'T', companyId: id() })],
        [User, 'findById', () => chain({ companyDetails: { isVerified: false } })]
    ], async () => {
        assert.match((await risk.moderateListing(admin, listingId, 'restore', '')).error, /Verify the company/);
    });
});

test('pausing updates only if the status is unchanged, logs it and tells the company', async () => {
    const listingId = id();
    const companyId = id();
    const calls = { update: null, notes: [], logs: [] };
    await withStubs([
        [Internship, 'findById', () => chain({ _id: listingId, status: 'published', title: 'Data Intern', companyId })],
        [Internship, 'updateOne', async (filter, update) => { calls.update = { filter, update }; return { modifiedCount: 1 }; }],
        [Notification, 'create', async doc => { calls.notes.push(doc); return doc; }],
        [AdminAction, 'create', async doc => { calls.logs.push(doc); return doc; }]
    ], async () => {
        const result = await risk.moderateListing(admin, listingId, 'pause', 'Asks candidates for a deposit');
        assert.deepEqual(result, { ok: true, from: 'published', to: 'paused' });
    });
    assert.equal(calls.update.filter.status, 'published');
    assert.deepEqual(calls.update.update.$set, { status: 'paused', isPaused: true });
    assert.equal(String(calls.notes[0].companyId), String(companyId));
    assert.match(calls.notes[0].message, /Asks candidates for a deposit/);
    assert.equal(calls.logs[0].action, 'listing.pause');
    assert.deepEqual(calls.logs[0].details, { from: 'published', to: 'paused' });

    await withStubs([
        [Internship, 'findById', () => chain({ _id: listingId, status: 'published', title: 'Data Intern', companyId })],
        [Internship, 'updateOne', async () => ({ modifiedCount: 0 })]
    ], async () => {
        assert.match((await risk.moderateListing(admin, listingId, 'close', 'Duplicate of another listing')).error, /changed while you were looking/);
    });
});

// --- Suspensions ---

test('only candidates and company team members can be suspended, never yourself', () => {
    const self = { _id: admin._id, role: 'admin' };
    assert.match(suspensions.suspensionBlocker(admin, self), /your own account/);
    assert.match(suspensions.suspensionBlocker(admin, { _id: id(), role: 'admin' }), /Admin accounts/);
    assert.match(suspensions.suspensionBlocker(admin, { _id: id(), role: 'company' }), /employer verification/);
    assert.equal(suspensions.suspensionBlocker(admin, { _id: id(), role: 'candidate' }), null);
    assert.equal(suspensions.suspensionBlocker(admin, { _id: id(), role: 'recruiter' }), null);
    assert.match(suspensions.suspensionBlocker(admin, null), /not found/);
});

test('a reason is required and shown cleanly to the user', () => {
    assert.match(suspensions.validateReason('spam').error, /at least 10/);
    assert.equal(suspensions.validateReason('  Fake applications reported  ').reason, 'Fake applications reported');
    assert.equal(suspensions.suspendedMessage('Fake applications.'),
        'Your account has been suspended. Reason: Fake applications. If you think this is a mistake, contact the InternPilot team.');
});

test('suspending twice is refused, and a suspension is logged', async () => {
    const target = { _id: id(), role: 'candidate', name: 'Ravi', email: 'ravi@example.com' };
    const logs = [];
    await withStubs([
        [AccountSuspension, 'create', async () => { const e = new Error('dup'); e.code = 11000; throw e; }]
    ], async () => {
        assert.match((await suspensions.suspendUser(admin, target, 'Fake applications reported')).error, /already suspended/);
    });
    await withStubs([
        [AccountSuspension, 'create', async doc => doc],
        [AdminAction, 'create', async doc => { logs.push(doc); return doc; }]
    ], async () => {
        assert.deepEqual(await suspensions.suspendUser(admin, target, 'Fake applications reported'), { ok: true });
    });
    assert.equal(logs[0].action, 'user.suspend');
    assert.match(logs[0].targetLabel, /Ravi/);
});

function fakeReqRes(user, { json = false } = {}) {
    const state = { flashed: [], redirected: null, status: null, body: null, loggedOut: false, nexted: false };
    const req = {
        user,
        xhr: json,
        get: () => undefined,
        accepts: () => (json ? 'json' : 'html'),
        flash: (type, msg) => state.flashed.push([type, msg]),
        logout: cb => { state.loggedOut = true; cb(); }
    };
    const res = {
        redirect: url => { state.redirected = url; },
        status(code) { state.status = code; return this; },
        json(body) { state.body = body; }
    };
    return { req, res, state, next: () => { state.nexted = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('a suspended user is signed out on their next request', async () => {
    suspensions.clearSuspensionCache();
    const user = { _id: id(), role: 'candidate' };
    await withStubs([[AccountSuspension, 'findOne', () => chain({ reason: 'Fake applications' })]], async () => {
        const page = fakeReqRes(user);
        suspensions.enforceSuspension(page.req, page.res, page.next);
        await settle();
        assert.equal(page.state.loggedOut, true);
        assert.equal(page.state.redirected, '/auth/login');
        assert.match(page.state.flashed[0][1], /Reason: Fake applications/);
        assert.equal(page.state.nexted, false);

        suspensions.clearSuspensionCache();
        const api = fakeReqRes(user, { json: true });
        suspensions.enforceSuspension(api.req, api.res, api.next);
        await settle();
        assert.equal(api.state.status, 403);
    });
});

test('admins, active users and failed lookups pass through', async () => {
    suspensions.clearSuspensionCache();
    const adminCall = fakeReqRes({ _id: id(), role: 'admin' });
    suspensions.enforceSuspension(adminCall.req, adminCall.res, adminCall.next);
    assert.equal(adminCall.state.nexted, true);

    await withStubs([[AccountSuspension, 'findOne', () => chain(null)]], async () => {
        const active = fakeReqRes({ _id: id(), role: 'candidate' });
        suspensions.enforceSuspension(active.req, active.res, active.next);
        await settle();
        assert.equal(active.state.nexted, true);
    });

    await quiet(() => withStubs([[AccountSuspension, 'findOne', () => { throw new Error('db down'); }]], async () => {
        suspensions.clearSuspensionCache();
        const broken = fakeReqRes({ _id: id(), role: 'candidate' });
        suspensions.enforceSuspension(broken.req, broken.res, broken.next);
        await settle();
        assert.equal(broken.state.nexted, true);
    }));
});

test('reactivating needs an active suspension and notifies the user', async () => {
    const target = { _id: id(), role: 'candidate', name: 'Ravi', email: 'r@example.com' };
    const notes = [];
    await withStubs([[AccountSuspension, 'findOneAndUpdate', async () => null]], async () => {
        assert.match((await suspensions.reactivateUser(admin, target, '')).error, /not suspended/);
    });
    await withStubs([
        [AccountSuspension, 'findOneAndUpdate', async () => ({ _id: id() })],
        [AdminAction, 'create', async doc => doc],
        [Notification, 'create', async doc => { notes.push(doc); return doc; }]
    ], async () => {
        assert.deepEqual(await suspensions.reactivateUser(admin, target, 'Identity confirmed'), { ok: true });
    });
    assert.equal(String(notes[0].recipient), String(target._id));
});

// --- Announcements ---

test('banners respect their audience and time window', () => {
    const now = new Date('2026-09-27T10:00:00Z');
    const live = { audience: 'everyone', startsAt: new Date(now - DAY) };
    const forCandidates = { audience: 'candidates', startsAt: new Date(now - DAY) };
    const forCompanies = { audience: 'companies', startsAt: new Date(now - DAY), endsAt: new Date(now.getTime() + DAY) };
    const scheduled = { audience: 'everyone', startsAt: new Date(now.getTime() + DAY) };
    const expired = { audience: 'everyone', startsAt: new Date(now - 2 * DAY), endsAt: new Date(now - DAY) };
    const ended = { audience: 'everyone', startsAt: new Date(now - DAY), endedAt: new Date(now - 60000) };
    const all = [live, forCandidates, forCompanies, scheduled, expired, ended];

    assert.deepEqual(announcements.visibleTo(all, null, now), [live]);
    assert.deepEqual(announcements.visibleTo(all, { role: 'candidate' }, now), [live, forCandidates]);
    assert.deepEqual(announcements.visibleTo(all, { role: 'recruiter' }, now), [live, forCompanies]);
    assert.deepEqual(announcements.visibleTo(all, { role: 'admin' }, now), [live]);
});

test('dates from the form are read as India time', () => {
    assert.equal(announcements.parseLocalDateTime('2026-09-27T10:30').toISOString(), '2026-09-27T05:00:00.000Z');
    assert.equal(announcements.parseLocalDateTime(''), null);
    assert.equal(announcements.parseLocalDateTime('27/09/2026'), undefined);
});

test('the announcement form is validated', () => {
    const now = new Date('2026-09-27T10:00:00Z');
    const ok = announcements.validateAnnouncement({ title: 'Maintenance tonight', message: 'The portal is down from 11 pm to midnight.', audience: 'everyone', tone: 'warning', notify: '1' }, now);
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.value.startsAt, now);
    assert.equal(ok.value.notify, true);

    const bad = announcements.validateAnnouncement({ title: 'Hi', message: 'short', audience: 'aliens', tone: 'loud', startsAt: '2026-09-28T10:00', endsAt: '2026-09-27T10:00' }, now);
    assert.equal(bad.errors.length, 5);
    const tooLong = announcements.validateAnnouncement({ title: 'Long banner', message: 'Runs for far too long.', audience: 'everyone', tone: 'info', startsAt: '2026-09-27T10:00', endsAt: '2027-03-01T10:00' }, now);
    assert.match(tooLong.errors[0], /at most 90 days/);
});

test('announcement states read naturally', () => {
    const now = new Date('2026-09-27T10:00:00Z');
    assert.equal(announcements.stateOf({ startsAt: new Date(now - DAY) }, now).key, 'live');
    assert.equal(announcements.stateOf({ startsAt: new Date(now.getTime() + DAY) }, now).key, 'scheduled');
    assert.equal(announcements.stateOf({ startsAt: new Date(now - 2 * DAY), endsAt: new Date(now - DAY) }, now).key, 'expired');
    assert.equal(announcements.stateOf({ startsAt: new Date(now - DAY), endedAt: now }, now).key, 'ended');
});

test('pages get only the banners meant for the visitor; JSON calls are skipped', async () => {
    announcements.clearAnnouncementCache();
    const items = [
        { _id: id(), title: 'For everyone', message: 'm', audience: 'everyone', tone: 'info', startsAt: new Date(Date.now() - DAY) },
        { _id: id(), title: 'For companies', message: 'm', audience: 'companies', tone: 'warning', startsAt: new Date(Date.now() - DAY) }
    ];
    await withStubs([[Announcement, 'find', () => chain(items)]], async () => {
        const res = { locals: {} };
        await new Promise(resolve => announcements.loadAnnouncements({ method: 'GET', user: { role: 'candidate' }, xhr: false, get: () => undefined, accepts: () => 'html' }, res, resolve));
        assert.deepEqual(res.locals.siteAnnouncements.map(a => a.title), ['For everyone']);

        const api = { locals: {} };
        await new Promise(resolve => announcements.loadAnnouncements({ method: 'GET', user: null, xhr: true, get: () => undefined, accepts: () => 'json' }, api, resolve));
        assert.equal(api.locals.siteAnnouncements, undefined);
    });
    announcements.clearAnnouncementCache();
});

test('notifications go to candidates directly and to companies once per company', async () => {
    const inserted = [];
    await withStubs([
        [User, 'find', query => chain(query.role === 'candidate' ? [{ _id: id() }, { _id: id() }] : [{ _id: id() }])],
        [Notification, 'insertMany', async docs => { inserted.push(...docs); return docs; }]
    ], async () => {
        assert.equal(await announcements.notifyAudience({ audience: 'everyone', title: 't', message: 'm' }), 3);
        assert.equal(inserted.filter(d => d.recipient).length, 2);
        assert.equal(inserted.filter(d => d.companyId).length, 1);
        inserted.length = 0;
        assert.equal(await announcements.notifyAudience({ audience: 'companies', title: 't', message: 'm' }), 1);
    });
});

// --- Audit log ---

test('a failed audit write never breaks the action', async () => {
    await quiet(() => withStubs([[AdminAction, 'create', async () => { throw new Error('db down'); }]], async () => {
        assert.equal(await audit.logAdminAction(admin, { action: 'user.suspend', targetType: 'user' }), null);
    }));
});

test('the console notification types are accepted by the notification centre', async () => {
    for (const type of ['announcement', 'listing_moderation', 'account_update']) {
        await assert.doesNotReject(new Notification({ recipient: id(), type, title: 't', message: 'm' }).validate(), type);
    }
});

test('application filters only accept known statuses and read dates in India time', async () => {
    const q = await directory.applicationQuery({ status: 'Hired', from: '2026-09-01', to: '2026-09-30' });
    assert.equal(q.status, 'Hired');
    assert.equal(q.createdAt.$gte.toISOString(), '2026-08-31T18:30:00.000Z');
    assert.equal((await directory.applicationQuery({ status: 'Anything' })).status, undefined);
    assert.equal((await directory.applicationQuery({ from: 'yesterday' })).createdAt, undefined);
});

// --- Pages ---

test('the overview renders every section and escapes data', () => {
    const html = render('admin-console/overview.ejs', { data: sampleOverview(), ranges: analytics.RANGES, consoleSection: 'overview' });
    assert.match(html, /data-kpi="candidates"/);
    assert.match(html, /\+100%/);
    assert.match(html, /data-funnel="Hired"/);
    assert.match(html, /&lt;b&gt;Goa&lt;\/b&gt;/);
    assert.match(html, /data-skill="React"/);
    assert.match(html, /data-pmis="eligible"/);
    assert.match(html, /aria-current=page[^>]*>Overview|href="\/admin\/overview" aria-current=page/);
});

test('listings show their flags and only the moderation actions that make sense', () => {
    const base = { _id: id(), title: 'Data Intern', companyName: 'Acme', vacancies: 2, monthlyStipend: 5000, duration: '3 Months', location: {} };
    const html = render('admin-console/listings.ejs', {
        items: [
            { ...base, status: 'published', flags: [risk.RISK_RULES.fees && { id: 'fees', ...risk.RISK_RULES.fees }], risk: 'high' },
            { ...base, _id: id(), status: 'draft', flags: [], risk: 'none' }
        ],
        counts: { all: 2, high: 1, medium: 0, low: 0, none: 1 },
        filters: { status: 'all', risk: '', q: '' },
        page: 1, pages: 1, scanned: 2, scanLimit: 500,
        rules: risk.RISK_RULES,
        currentUrl: '/admin/listings?status=all'
    });
    assert.match(html, /data-flag="fees"/);
    assert.equal((html.match(/name="action" value="pause"/g) || []).length, 1);
    assert.doesNotMatch(html, /value="restore"[\s\S]*value="restore"/);
});

test('the user page offers the right access control for each account', () => {
    const base = { user: { _id: id(), name: 'Ravi', email: 'ravi@example.com', role: 'candidate', roleLabel: 'Candidate' }, applications: [], listings: [], history: [], actions: [] };
    assert.match(render('admin-console/user.ejs', { ...base, suspension: null, canSuspend: true, suspendBlocker: null }), /id="suspendForm"/);

    const suspended = render('admin-console/user.ejs', {
        ...base,
        suspension: { reason: '<i>spam</i>', suspendedBy: { name: 'Admin' } },
        history: [{ active: true, reason: '<i>spam</i>', fromLabel: '27 Sept 2026', toLabel: '' }],
        canSuspend: true,
        suspendBlocker: null
    });
    assert.match(suspended, /id="reactivateForm"/);
    assert.doesNotMatch(suspended, /<i>spam<\/i>/);

    const owner = render('admin-console/user.ejs', { ...base, user: { ...base.user, role: 'company', roleLabel: 'Company' }, suspension: null, canSuspend: false, suspendBlocker: 'Company accounts are managed through employer verification.' });
    assert.doesNotMatch(owner, /id="suspendForm"/);
    assert.match(owner, /employer verification/);
});

test('the other console pages render', () => {
    const pager = { page: 1, pages: 1, total: 1 };
    assert.match(render('admin-console/users.ejs', { ...pager, items: [{ _id: id(), name: 'Asha', email: 'a@x.in', role: 'candidate', roleLabel: 'Candidate', suspended: true, joinedLabel: '' }], filters: { q: '', role: '', status: '' }, roles: directory.ROLES }), /data-suspended/);
    assert.match(render('admin-console/applications.ejs', { ...pager, items: [], counts: {}, filters: { status: '', q: '', from: '', to: '' }, statuses: directory.APPLICATION_STATUSES, csvQuery: '' }), /Download CSV/);
    assert.match(render('admin-console/announcements.ejs', { items: [{ _id: id(), title: 'Down tonight', message: 'm', state: { key: 'live', label: 'Live' }, audienceLabel: 'Everyone', toneLabel: 'Info', startsLabel: 'now', endsLabel: '' }], values: {}, errors: [], audiences: announcements.AUDIENCES, tones: announcements.TONES, limits: announcements.LIMITS }), /End now/);
    assert.match(render('admin-console/audit.ejs', { ...pager, items: [{ action: 'user.suspend', label: 'Suspended sign-in', targetType: 'user', targetId: id(), targetLabel: 'Ravi', reason: 'Spam', createdAt: new Date() }], actions: audit.ACTION_LABELS, filters: { action: '' } }), /Suspended sign-in/);
});

test('the site banner escapes text and can be dismissed', () => {
    const html = ejs.render(fs.readFileSync(viewPath('partials/site-announcements.ejs'), 'utf8'), {
        siteAnnouncements: [{ id: 'a1', title: '<script>x</script>', message: 'Down tonight', tone: announcements.TONES.warning }]
    });
    assert.doesNotMatch(html, /<script>x<\/script>/);
    assert.match(html, /data-dismiss-announcement/);
    assert.match(html, /localStorage/);
});

// --- Wiring ---

test('the console is mounted before the page and admin routes, and every console page is admin-only', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const mount = app.indexOf("require('./routes/adminConsole')");
    assert.ok(mount > -1);
    assert.ok(mount < app.indexOf("app.use('/', pagesRoutes)"));
    assert.ok(mount < app.indexOf("app.use('/admin', adminRoutes)"));

    const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'adminConsole.js'), 'utf8');
    const adminRoutes = routes.split('\n').filter(line => /router\.(get|post)\('\/admin/.test(line));
    assert.ok(adminRoutes.length >= 12);
    adminRoutes.forEach(line => assert.match(line, /\.\.\.adminOnly/, line));

    const layout = fs.readFileSync(viewPath('layouts/boilerplate.ejs'), 'utf8');
    assert.match(layout, /typeof siteAnnouncements !== 'undefined'/);
    assert.match(fs.readFileSync(viewPath('admin/dashboard.ejs'), 'utf8'), /id="adminConsoleLink"/);
});

// --- Deleting accounts ---

const deletion = require('../utils/accountDeletion');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

test('only candidates and company team members can be deleted, never yourself', () => {
    assert.match(deletion.deletionBlocker(admin, { _id: admin._id, role: 'admin' }), /your own account/);
    assert.match(deletion.deletionBlocker(admin, { _id: id(), role: 'admin' }), /Admin accounts/);
    assert.match(deletion.deletionBlocker(admin, { _id: id(), role: 'company' }), /employer verification/);
    assert.equal(deletion.deletionBlocker(admin, { _id: id(), role: 'candidate' }), null);
    assert.equal(deletion.deletionBlocker(admin, { _id: id(), role: 'hiring_manager' }), null);
    assert.match(deletion.deletionBlocker(admin, null), /not found/);
});

// Records every deleteMany on the models an account deletion touches.
function deletionStubs(target, calls, { conversations = [] } = {}) {
    const models = [...new Set([...deletion.steps(target).map(s => s.model), Message])];
    return [
        [Conversation, 'find', () => chain(conversations)],
        ...models.map(model => [model, 'deleteMany', async filter => { calls.push([model.modelName, filter]); return { deletedCount: 2 }; }]),
        [User, 'deleteOne', async filter => { calls.push(['User', filter]); return { deletedCount: 1 }; }],
        [AdminAction, 'create', async doc => { calls.push(['AdminAction', doc]); return doc; }]
    ];
}

test('deleting needs the exact email and a reason, and removes nothing otherwise', async () => {
    const target = { _id: id(), role: 'candidate', name: 'Ravi', email: 'Ravi@Example.com' };
    const calls = [];
    await withStubs(deletionStubs(target, calls), async () => {
        assert.match((await deletion.deleteAccount(admin, target, { confirmEmail: 'someone@example.com', reason: 'Asked to delete my data' })).error, /Type the account's email/);
        assert.match((await deletion.deleteAccount(admin, target, { confirmEmail: 'ravi@example.com', reason: 'bye' })).error, /audit log/);
    });
    assert.equal(calls.length, 0);
});

test("a candidate's data goes with the account, and the account goes last", async () => {
    const target = { _id: id(), role: 'candidate', name: 'Ravi', email: 'ravi@example.com' };
    const conversationId = id();
    const calls = [];
    let result;
    await withStubs(deletionStubs(target, calls, { conversations: [{ _id: conversationId }] }), async () => {
        result = await deletion.deleteAccount(admin, target, { confirmEmail: ' RAVI@example.com ', reason: 'The candidate asked for their data to be deleted' });
    });
    assert.equal(result.ok, true);
    const touched = calls.map(c => c[0]);
    ['Message', 'Application', 'Conversation', 'Notification', 'Grievance', 'Recommendation', 'SavedSearch', 'ResumeParse', 'AccountSuspension'].forEach(name => {
        assert.ok(touched.includes(name), name);
    });
    assert.deepEqual(calls.find(c => c[0] === 'Message')[1], { conversation: { $in: [conversationId] } });
    assert.equal(touched.indexOf('User'), touched.length - 2, 'the account is deleted after everything else, then logged');
    const log = calls[calls.length - 1][1];
    assert.equal(log.action, 'user.delete');
    assert.match(log.targetLabel, /ravi@example.com/);
    assert.equal(log.details.account, 1);
    assert.equal(log.details.applications, 2);
});

test("a team member's own records go, the company's stay", async () => {
    const target = { _id: id(), role: 'recruiter', name: 'Rec', email: 'rec@acme.example' };
    const calls = [];
    await withStubs(deletionStubs(target, calls), async () => {
        assert.equal((await deletion.deleteAccount(admin, target, { confirmEmail: 'rec@acme.example', reason: 'Left the company last month' })).ok, true);
    });
    const touched = calls.map(c => c[0]);
    assert.ok(!touched.includes('Application') && !touched.includes('Message') && !touched.includes('Conversation'));
    assert.ok(touched.includes('Notification') && touched.includes('User'));
});

test('the preview only lists what exists', async () => {
    const target = { _id: id(), role: 'candidate' };
    const stubs = deletion.steps(target).map(s => [s.model, 'countDocuments', async () => (s.key === 'applications' ? 3 : 0)]);
    await withStubs(stubs, async () => {
        assert.deepEqual(await deletion.deletionPreview(target), [{ key: 'applications', label: 'Applications', count: 3 }]);
    });
});

test('the user page shows the delete panel only for accounts that can be deleted', () => {
    const base = { user: { _id: id(), name: 'Ravi', email: 'ravi@example.com', role: 'candidate', roleLabel: 'Candidate' }, applications: [], listings: [], history: [], actions: [], suspension: null, canSuspend: true, suspendBlocker: null };
    const html = render('admin-console/user.ejs', { ...base, deletion: { blocker: null, items: [{ key: 'applications', label: 'Applications', count: 3 }] } });
    assert.match(html, /id="deleteForm"/);
    assert.match(html, /data-delete-preview/);
    const owner = render('admin-console/user.ejs', { ...base, deletion: { blocker: 'Company accounts are handled through employer verification.', items: [] } });
    assert.doesNotMatch(owner, /id="deleteForm"/);
    assert.match(owner, /data-delete-blocked/);
});

test('deleted accounts are not linked from the audit log', () => {
    const html = render('admin-console/audit.ejs', {
        page: 1, pages: 1, total: 1,
        items: [{ action: 'user.delete', label: 'Deleted an account', targetType: 'user', targetId: id(), targetLabel: 'Ravi <ravi@example.com>', reason: 'Asked', createdAt: new Date() }],
        actions: audit.ACTION_LABELS,
        filters: { action: '' }
    });
    assert.match(html, /Deleted an account/);
    assert.doesNotMatch(html, /href="\/admin\/users\//);
});
