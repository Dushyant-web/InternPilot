const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const mongoose = require('mongoose');

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

function renderApplicationsView(viewName, statusUpdatedAt) {
    const viewPath = path.join(__dirname, '..', 'views', 'candidate', viewName);
    const template = fs.readFileSync(viewPath, 'utf8')
        .replace("<% layout('layouts/boilerplate') %>", '');
    const application = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Under Review',
        appliedAt: new Date('2026-09-20T12:00:00.000Z'),
        statusUpdatedAt,
        matchScore: 80,
        interview: null,
        notes: [],
        internship: {
            _id: new mongoose.Types.ObjectId(),
            title: 'Software Intern',
            companyName: 'Acme Labs',
            sector: 'Technology',
            monthlyStipend: 10000,
            location: { district: 'Pune', state: 'Maharashtra' }
        }
    };

    return ejs.render(template, {
        applications: [application],
        candidate: { _id: new mongoose.Types.ObjectId(), name: 'Asha' },
        currentUser: { _id: new mongoose.Types.ObjectId(), role: 'candidate' },
        pageTitle: 'My Applications',
        formatRelativeTime: () => '3 days ago',
        formatLocalizedDateTime: () => '24 Sept 2026, 5:30 pm'
    }, { filename: viewPath });
}

test('student application views show a human-readable status update timestamp', () => {
    const updatedAt = new Date('2026-09-21T12:00:00.000Z');

    for (const viewName of ['candidate-tracker.ejs', 'my-applications.ejs']) {
        const html = renderApplicationsView(viewName, updatedAt);
        assert.match(html, /Updated 3 days ago/);
        assert.match(html, /Last status update: 24 Sept 2026, 5:30 pm/);
        assert.match(html, /aria-label="Last status update: 24 Sept 2026, 5:30 pm"/);
        assert.match(html, /datetime="2026-09-21T12:00:00\.000Z"/);
    }
});

test('student application views fall back to the application date for legacy records', () => {
    for (const viewName of ['candidate-tracker.ejs', 'my-applications.ejs']) {
        const html = renderApplicationsView(viewName, null);
        assert.match(html, /Updated 3 days ago/);
    }
});
