const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ejs = require('ejs');
const mongoose = require('mongoose');

const User = require('../models/User');
const { LOGO_MAX_BYTES, LOGO_EXTENSIONS } = require('../middleware/upload');

test('User schema defines all required companyDetails fields for Company Profile', () => {
    const userInstance = new User({
        name: 'Tech Corp',
        email: 'recruiter@techcorp.com',
        role: 'company',
        companyDetails: {
            companyName: 'Tech Corp India',
            cin: 'U72200MH2020PTC123456',
            industry: 'IT & Software Services',
            logo: 'https://res.cloudinary.com/demo/image/upload/logo.png',
            description: 'Leading software innovations for enterprises.',
            website: 'https://techcorp.example.com',
            location: 'Bengaluru, Karnataka',
            contactEmail: 'careers@techcorp.example.com',
            contactPhone: '+91 9876543210',
            contactInformation: 'Mon-Fri 9am-6pm IST',
            companySize: '51-200 Employees',
            isVerified: true
        }
    });

    const details = userInstance.companyDetails;
    assert.equal(details.companyName, 'Tech Corp India');
    assert.equal(details.cin, 'U72200MH2020PTC123456');
    assert.equal(details.industry, 'IT & Software Services');
    assert.equal(details.logo, 'https://res.cloudinary.com/demo/image/upload/logo.png');
    assert.equal(details.description, 'Leading software innovations for enterprises.');
    assert.equal(details.website, 'https://techcorp.example.com');
    assert.equal(details.location, 'Bengaluru, Karnataka');
    assert.equal(details.contactEmail, 'careers@techcorp.example.com');
    assert.equal(details.contactPhone, '+91 9876543210');
    assert.equal(details.contactInformation, 'Mon-Fri 9am-6pm IST');
    assert.equal(details.companySize, '51-200 Employees');
    assert.equal(details.isVerified, true);
});

test('Logo upload configuration enforces max 3MB file size and allowed image extensions', () => {
    assert.equal(LOGO_MAX_BYTES, 3 * 1024 * 1024);
    assert.ok(LOGO_EXTENSIONS.includes('.png'));
    assert.ok(LOGO_EXTENSIONS.includes('.jpg'));
    assert.ok(LOGO_EXTENSIONS.includes('.jpeg'));
    assert.ok(LOGO_EXTENSIONS.includes('.webp'));
    assert.ok(LOGO_EXTENSIONS.includes('.svg'));
});

test('company-profile.ejs renders complete edit form with all required fields', () => {
    const templatePath = path.join(__dirname, '..', 'views', 'company', 'company-profile.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8')
        .replace("<% layout('layouts/boilerplate') %>", "");

    const companyId = new mongoose.Types.ObjectId();
    const html = ejs.render(templateContent, {
        user: { _id: companyId, name: 'John Recruiter', role: 'recruiter', companyId },
        company: { _id: companyId, name: 'Acme Corp' },
        companyDetails: {
            companyName: 'Acme Corp',
            industry: 'IT & Software Services',
            logo: 'https://example.com/logo.png',
            description: 'Building modern cloud software solutions.',
            website: 'https://acme.example.com',
            location: 'Mumbai, Maharashtra',
            contactEmail: 'hr@acme.example.com',
            contactPhone: '+91 9999988888',
            companySize: '11-50 Employees',
            cin: 'U12345MH2021PTC000000',
            isVerified: true
        },
        companyInternshipsCount: 3
    });

    assert.ok(html.includes('action="/company/profile"'), 'Form action must point to /company/profile');
    assert.ok(html.includes('enctype="multipart/form-data"'), 'Form must support file uploads');
    assert.ok(html.includes('name="companyName"'), 'Must have companyName input');
    assert.ok(html.includes('name="logo"'), 'Must have logo file input');
    assert.ok(html.includes('name="industry"'), 'Must have industry field');
    assert.ok(html.includes('name="companySize"'), 'Must have companySize field');
    assert.ok(html.includes('name="website"'), 'Must have website field');
    assert.ok(html.includes('name="location"'), 'Must have location field');
    assert.ok(html.includes('name="contactEmail"'), 'Must have contactEmail field');
    assert.ok(html.includes('name="description"'), 'Must have description textarea');
    assert.ok(html.includes('Acme Corp'), 'Must display company name');
});

test('public-profile.ejs renders public company profile and active internship openings', () => {
    const templatePath = path.join(__dirname, '..', 'views', 'company', 'public-profile.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8')
        .replace("<% layout('layouts/boilerplate') %>", "");

    const companyId = new mongoose.Types.ObjectId();
    const internshipId = new mongoose.Types.ObjectId();

    const html = ejs.render(templateContent, {
        company: { _id: companyId, name: 'Apex Innovations' },
        companyDetails: {
            companyName: 'Apex Innovations',
            industry: 'Finance & Banking',
            logo: 'https://example.com/apex-logo.png',
            description: 'Next generation fintech platform.',
            website: 'https://apex.example.com',
            location: 'Hyderabad, Telangana',
            contactEmail: 'contact@apex.example.com',
            contactPhone: '+91 9876500000',
            companySize: '51-200 Employees',
            isVerified: true
        },
        internships: [
            {
                _id: internshipId,
                title: 'Fintech Software Intern',
                sector: 'Finance',
                vacancies: 2,
                monthlyStipend: 15000,
                duration: '6 Months',
                location: { district: 'Hyderabad', state: 'Telangana' },
                requiredSkills: ['Node.js', 'React', 'MongoDB'],
                applicationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            }
        ],
        currentUser: null,
        isCompanyOwnerOrRecruiter: false
    });

    assert.ok(html.includes('Apex Innovations'), 'Renders company name');
    assert.ok(html.includes('Finance &amp; Banking') || html.includes('Finance'), 'Renders industry');
    assert.ok(html.includes('https://apex.example.com'), 'Renders website link');
    assert.ok(html.includes('Fintech Software Intern'), 'Renders active internship title');
    assert.ok(html.includes('/internships/' + internshipId.toString()), 'Links to internship detail');
    assert.ok(html.includes('Verified Company'), 'Shows verification badge for verified company');
});

test('internship-detail.ejs links to the company profile and displays company credibility card', () => {
    const templatePath = path.join(__dirname, '..', 'views', 'extras', 'internship-detail.ejs');
    const templateContent = fs.readFileSync(templatePath, 'utf8')
        .replace("<% layout('layouts/boilerplate') %>", "");

    const companyId = new mongoose.Types.ObjectId();
    const internshipId = new mongoose.Types.ObjectId();

    const html = ejs.render(templateContent, {
        internship: {
            _id: internshipId,
            companyId,
            companyName: 'Global Enterprises',
            title: 'Full Stack Engineer Intern',
            sector: 'IT',
            vacancies: 3,
            monthlyStipend: 12000,
            duration: '12 Months',
            location: { district: 'Pune', state: 'Maharashtra' },
            requiredSkills: ['JavaScript', 'Express'],
            applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: 'published',
            isPaused: false
        },
        company: {
            _id: companyId,
            name: 'Global Enterprises',
            companyDetails: {
                companyName: 'Global Enterprises',
                logo: 'https://example.com/global-logo.png',
                description: 'Pioneers in enterprise technology solutions.',
                industry: 'IT & Software',
                companySize: '201-500 Employees',
                location: 'Pune, Maharashtra',
                isVerified: true
            }
        },
        candidate: null,
        currentUser: null,
        hasApplied: false,
        isPaused: false
    });

    assert.ok(html.includes('/company/' + companyId.toString() + '/profile'), 'Must link to company profile URL');
    assert.ok(html.includes('Global Enterprises'), 'Must display company name');
    assert.ok(html.includes('Pioneers in enterprise technology solutions'), 'Must render company description card');
    assert.ok(html.includes('Verified'), 'Must display verification badge');
});
