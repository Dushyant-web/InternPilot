const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ejs = require('ejs');

const internshipsViewPath = path.join(__dirname, '..', 'views', 'extras', 'internships.ejs');
const internshipsTemplate = fs.readFileSync(internshipsViewPath, 'utf8');

test('internships view compiles and renders an empty listing state', () => {
    assert.doesNotThrow(() => {
        ejs.compile(internshipsTemplate, { filename: internshipsViewPath });
    });

    const html = ejs.render(internshipsTemplate, {
        layout: () => undefined,
        currentUser: null,
        internships: [],
        queryState: {},
        currentFilter: 'all',
        pagination: null,
        sectors: [],
        appliedIds: []
    }, { filename: internshipsViewPath });

    assert.match(html, /No matching internships found/);
});
