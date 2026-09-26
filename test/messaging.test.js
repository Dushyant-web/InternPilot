const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const {
    MAX_MESSAGE_LENGTH,
    isReadOnlyStatus,
    resolveCompanyId,
    sideFor,
    sideForApplication,
    validateMessageBody,
    previewOf,
    createRateLimiter,
    hasUnread,
    lastReadAt,
    inboxQuery
} = require('../utils/messaging');

const id = () => new mongoose.Types.ObjectId();

const companyId = id();
const otherCompanyId = id();
const candidate = { _id: id(), role: 'candidate' };
const otherCandidate = { _id: id(), role: 'candidate' };
const owner = { _id: companyId, role: 'company' };            // legacy owner, no companyId
const recruiter = { _id: id(), role: 'recruiter', companyId };
const hiringManager = { _id: id(), role: 'hiring_manager', companyId };
const outsider = { _id: id(), role: 'recruiter', companyId: otherCompanyId };
const admin = { _id: id(), role: 'admin' };

const conversation = { _id: id(), candidate: candidate._id, company: companyId };

test('only the candidate and the hiring company can see a thread', () => {
    assert.equal(sideFor(candidate, conversation), 'candidate');
    assert.equal(sideFor(owner, conversation), 'company');
    assert.equal(sideFor(recruiter, conversation), 'company');
    assert.equal(sideFor(hiringManager, conversation), 'company');

    assert.equal(sideFor(otherCandidate, conversation), null, 'another candidate');
    assert.equal(sideFor(outsider, conversation), null, 'a recruiter at another company');
    assert.equal(sideFor(admin, conversation), null);
    assert.equal(sideFor(null, conversation), null);
    assert.equal(sideFor(candidate, null), null);
});

test('populated references work the same as raw ids', () => {
    const populated = { candidate: { _id: candidate._id, name: 'A' }, company: { _id: companyId, name: 'C' } };
    assert.equal(sideFor(candidate, populated), 'candidate');
    assert.equal(sideFor(recruiter, populated), 'company');
});

test('an owner account without companyId acts for its own company', () => {
    assert.equal(resolveCompanyId(owner), String(companyId));
    assert.equal(resolveCompanyId(recruiter), String(companyId));
    assert.equal(resolveCompanyId({ _id: id(), role: 'recruiter' }), null, 'a recruiter needs a companyId');
});

test('starting a thread requires owning the application or the listing', () => {
    const application = { _id: id(), candidate: candidate._id };
    const listing = { _id: id(), companyId };
    const legacyListing = { _id: id(), postedBy: companyId };

    assert.equal(sideForApplication(candidate, application, listing), 'candidate');
    assert.equal(sideForApplication(recruiter, application, listing), 'company');
    assert.equal(sideForApplication(owner, application, legacyListing), 'company', 'older listings owned via postedBy');

    assert.equal(sideForApplication(otherCandidate, application, listing), null);
    assert.equal(sideForApplication(outsider, application, listing), null);
    assert.equal(sideForApplication(recruiter, application, { _id: id() }), null, 'listing with no owner');
});

test('withdrawn and rejected applications make the thread read-only', () => {
    ['Withdrawn', 'withdrawn', 'Rejected'].forEach(s => assert.equal(isReadOnlyStatus(s), true, s));
    ['Submitted', 'Under Review', 'Shortlisted', 'Interview', 'Hired', 'pending', undefined]
        .forEach(s => assert.equal(isReadOnlyStatus(s), false, String(s)));
});

test('message bodies are trimmed and length checked', () => {
    assert.deepEqual(validateMessageBody('  hello  '), { body: 'hello' });
    assert.deepEqual(validateMessageBody('line one\r\nline two'), { body: 'line one\nline two' });
    assert.ok(validateMessageBody('   ').error);
    assert.ok(validateMessageBody(undefined).error);
    assert.ok(validateMessageBody({ $gt: '' }).error, 'objects from a crafted body are rejected');
    assert.deepEqual(validateMessageBody('x'.repeat(MAX_MESSAGE_LENGTH)), { body: 'x'.repeat(MAX_MESSAGE_LENGTH) });
    assert.ok(validateMessageBody('x'.repeat(MAX_MESSAGE_LENGTH + 1)).error);
});

test('markup is kept as text, not stripped', () => {
    assert.deepEqual(validateMessageBody('<b>hi</b>'), { body: '<b>hi</b>' });
});

test('previews are one line and capped', () => {
    assert.equal(previewOf('hello\n\n  there'), 'hello there');
    const long = previewOf('a'.repeat(500));
    assert.equal(long.length, 140);
    assert.ok(long.endsWith('…'));
});

test('the rate limiter allows a burst, blocks the next, and recovers', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });

    assert.equal(limiter.hit('u1').allowed, true);
    assert.equal(limiter.hit('u1').allowed, true);
    assert.equal(limiter.hit('u1').allowed, true);

    const blocked = limiter.hit('u1');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 60_000);

    assert.equal(limiter.hit('u2').allowed, true, 'limits are per user');

    now += 60_000;
    assert.equal(limiter.hit('u1').allowed, true, 'allowed again once the window has passed');
});

test('unread means a newer message from someone else', () => {
    const t = ms => new Date(Date.UTC(2026, 8, 26, 12, 0, 0) + ms);
    const base = { lastMessageAt: t(0), lastMessageBy: candidate._id, reads: [] };

    assert.equal(hasUnread({ ...base, lastMessageAt: null }, recruiter._id), false, 'no messages yet');
    assert.equal(hasUnread(base, candidate._id), false, 'your own message is never unread');
    assert.equal(hasUnread(base, recruiter._id), true, 'never opened');

    const read = { ...base, reads: [{ user: recruiter._id, at: t(1000) }] };
    assert.equal(lastReadAt(read, recruiter._id).getTime(), t(1000).getTime());
    assert.equal(hasUnread(read, recruiter._id), false, 'read after the last message');
    assert.equal(hasUnread({ ...read, lastMessageAt: t(2000) }, recruiter._id), true, 'a newer message arrived');
});

test('two recruiters at the same company track their own read state', () => {
    const conv = {
        lastMessageAt: new Date('2026-09-26T12:00:10Z'),
        lastMessageBy: candidate._id,
        reads: [{ user: recruiter._id, at: new Date('2026-09-26T12:00:20Z') }]
    };
    assert.equal(hasUnread(conv, recruiter._id), false);
    assert.equal(hasUnread(conv, hiringManager._id), true);
});

test('each role gets the right inbox', () => {
    assert.deepEqual(inboxQuery(candidate), { candidate: candidate._id });
    assert.deepEqual(inboxQuery(recruiter), { company: String(companyId) });
    assert.equal(inboxQuery(admin), null);
    assert.equal(inboxQuery(null), null);
});

test('message notifications are accepted by the notification centre', async () => {
    const note = new Notification({ recipient: candidate._id, type: 'new_message', title: 'New message', message: 'hi' });
    await assert.doesNotReject(note.validate());
    const junk = new Notification({ recipient: candidate._id, type: 'not_a_type', title: 't', message: 'm' });
    await assert.rejects(junk.validate());
});
