const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../models/User');
const {
    COMPANY_PERMISSIONS,
    companyPermissions,
    hasCompanyPermission,
    requireCompanyPermission
} = require('../middleware/companyAccess');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        render() {
            return this;
        }
    };
}

test('company roles expose the intended permission matrix', () => {
    assert.deepEqual(COMPANY_PERMISSIONS.company, [
        'dashboard:view',
        'team:manage',
        'internship:create',
        'internship:edit',
        'internship:delete',
        'applications:view',
        'applications:review'
    ]);
    assert.equal(hasCompanyPermission({ role: 'recruiter' }, 'internship:create'), true);
    assert.equal(hasCompanyPermission({ role: 'recruiter' }, 'internship:delete'), false);
    assert.deepEqual(companyPermissions({ role: 'hiring_manager' }), [
        'dashboard:view',
        'applications:view'
    ]);
});

test('permission middleware resolves legacy company owners and denies a hiring manager mutation', async () => {
    const originalFindOne = User.findOne;
    try {
        User.findOne = async ({ _id }) => ({ _id, role: 'company' });

        const legacyOwnerRequest = {
            user: { _id: 'legacy-company-id', role: 'company' },
            accepts: () => 'json',
            flash: () => {}
        };
        const legacyOwnerResponse = createResponse();
        let nextCalled = false;

        await requireCompanyPermission('internship:delete')(
            legacyOwnerRequest,
            legacyOwnerResponse,
            () => { nextCalled = true; }
        );

        assert.equal(nextCalled, true);
        assert.equal(String(legacyOwnerRequest.company._id), 'legacy-company-id');

        const managerRequest = {
            user: { _id: 'manager-id', companyId: 'legacy-company-id', role: 'hiring_manager' },
            accepts: () => 'json',
            flash: () => {}
        };
        const managerResponse = createResponse();

        await requireCompanyPermission('internship:delete')(
            managerRequest,
            managerResponse,
            () => { throw new Error('A hiring manager must not reach the mutation handler.'); }
        );

        assert.equal(managerResponse.statusCode, 403);
        assert.equal(managerResponse.body.error, 'You do not have permission to perform this action.');
    } finally {
        User.findOne = originalFindOne;
    }
});
