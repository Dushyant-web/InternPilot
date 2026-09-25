const test = require('node:test');
const assert = require('node:assert/strict');

const Application = require('../models/Application');
const {
    formatRelativeTime,
    formatLocalizedDateTime
} = require('../utils/dateFormat');

test('new applications receive a status update timestamp', () => {
    const application = new Application({
        internship: '66aa00000000000000000001',
        candidate: '66aa00000000000000000002'
    });

    assert.ok(application.statusUpdatedAt instanceof Date);
    assert.equal(application.status, 'Submitted');
});

test('a status change refreshes the timestamp while an unchanged status does not', async () => {
    const application = new Application({
        internship: '66aa00000000000000000001',
        candidate: '66aa00000000000000000002'
    });
    const originalTimestamp = new Date('2020-01-01T00:00:00.000Z');

    application.$isNew = false;
    application.statusUpdatedAt = originalTimestamp;
    application.$__.activePaths.clear('modify');
    application.status = 'Under Review';

    await Application.schema.s.hooks.execPre('save', application, [{}]);
    assert.ok(application.statusUpdatedAt > originalTimestamp);

    const unchangedTimestamp = application.statusUpdatedAt;
    application.$__.activePaths.clear('modify');
    application.status = 'Under Review';
    await Application.schema.s.hooks.execPre('save', application, [{}]);

    assert.equal(application.statusUpdatedAt.getTime(), unchangedTimestamp.getTime());
});

test('formats a human-readable relative update time', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');

    assert.equal(formatRelativeTime('2026-09-21T12:00:00.000Z', now), '3 days ago');
    assert.equal(formatRelativeTime('2026-09-24T11:59:45.000Z', now), 'just now');
    assert.equal(formatRelativeTime('not-a-date', now), '');
});

test('formats an exact status update time for India', () => {
    const formatted = formatLocalizedDateTime('2026-09-24T12:00:00.000Z');

    assert.match(formatted, /24 Sept 2026/);
    assert.match(formatted, /5:30 pm/i);
});
