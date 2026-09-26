const test = require('node:test');
const assert = require('node:assert/strict');

const Application = require('../models/Application');
const { sanitizeHttpUrl, isSafeHttpUrl } = require('../utils/safeUrl');

test('safe URL sanitizer accepts normalized HTTP and HTTPS meeting links', () => {
    assert.equal(
        sanitizeHttpUrl('https://meet.example.test/room').url,
        'https://meet.example.test/room'
    );
    assert.equal(
        sanitizeHttpUrl(' http://meet.example.test/room ').url,
        'http://meet.example.test/room'
    );
    assert.equal(isSafeHttpUrl('https://meet.example.test/room'), true);
});

test('safe URL sanitizer rejects unsafe or malformed meeting links', () => {
    for (const value of [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'mailto:someone@example.test',
        'ftp://files.example.test/interview',
        'https://',
        'not a URL'
    ]) {
        assert.equal(sanitizeHttpUrl(value).url, '', `Expected ${value} to be rejected`);
        assert.equal(isSafeHttpUrl(value), false, `Expected ${value} to be unsafe`);
    }
});

test('application validation rejects an unsafe stored meeting link', async () => {
    const application = new Application({
        internship: '66aa00000000000000000001',
        candidate: '66aa00000000000000000002',
        interview: {
            mode: 'Online',
            meetingLink: 'javascript:alert(1)'
        }
    });

    await assert.rejects(application.validate(), /Meeting link must be a valid http:\/\/ or https:\/\/ URL\./);
});
