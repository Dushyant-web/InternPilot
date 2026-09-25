const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const ActivityLog = require('../models/ActivityLog');
const activityLogger = require('../utils/activityLogger');

function makeIds() {
    return {
        companyId: new mongoose.Types.ObjectId(),
        actorId: new mongoose.Types.ObjectId(),
        targetId: new mongoose.Types.ObjectId()
    };
}

test('ActivityLog defines the required audit fields, references, enums, and timeline index', () => {
    const { schema } = ActivityLog;

    for (const field of ['companyId', 'actorId', 'action', 'targetType', 'targetId', 'targetName', 'createdAt']) {
        assert.ok(schema.path(field), `Expected ActivityLog to define ${field}`);
    }

    assert.equal(schema.path('companyId').instance, 'ObjectId');
    assert.equal(schema.path('companyId').options.ref, 'User');
    assert.equal(schema.path('actorId').instance, 'ObjectId');
    assert.equal(schema.path('actorId').options.ref, 'User');
    assert.equal(schema.path('targetId').instance, 'ObjectId');

    assert.equal(schema.path('companyId').isRequired, true);
    assert.equal(schema.path('actorId').isRequired, true);
    assert.equal(schema.path('action').isRequired, true);
    assert.equal(schema.path('targetType').isRequired, true);
    assert.equal(schema.path('targetId').isRequired, true);
    assert.equal(schema.path('targetName').isRequired, true);

    assert.ok(schema.path('action').enumValues.includes('SHORTLIST_CANDIDATE'));
    assert.ok(schema.path('action').enumValues.includes('EDIT_LISTING'));
    assert.ok(schema.path('targetType').enumValues.includes('Candidate'));
    assert.ok(schema.path('targetType').enumValues.includes('Listing'));

    assert.ok(
        schema.indexes().some(([keys]) => keys.companyId === 1 && keys.createdAt === -1),
        'Expected an index for company-scoped newest-first activity queries'
    );
});

test('ActivityLog validates a valid audit record without connecting to MongoDB', () => {
    const { companyId, actorId, targetId } = makeIds();
    const log = new ActivityLog({
        companyId,
        actorId,
        action: 'SHORTLIST_CANDIDATE',
        targetType: 'Candidate',
        targetId,
        targetName: 'Asha Patel'
    });

    assert.equal(log.validateSync(), undefined);
});

test('ActivityLog rejects missing required audit values and unsupported action values', () => {
    const { companyId, actorId, targetId } = makeIds();
    const missingActor = new ActivityLog({
        companyId,
        action: 'SHORTLIST_CANDIDATE',
        targetType: 'Candidate',
        targetId,
        targetName: 'Asha Patel'
    });
    const invalidAction = new ActivityLog({
        companyId,
        actorId,
        action: 'UNSUPPORTED_AUDIT_ACTION',
        targetType: 'Candidate',
        targetId,
        targetName: 'Asha Patel'
    });

    assert.equal(missingActor.validateSync().errors.actorId.kind, 'required');
    assert.equal(invalidAction.validateSync().errors.action.kind, 'enum');
});

test('activity logger exports both public helpers', () => {
    assert.equal(typeof activityLogger.logActivity, 'function');
    assert.equal(typeof activityLogger.logRecruiterActivity, 'function');
});

test('logActivity forwards the canonical audit payload to ActivityLog.create', async () => {
    const { companyId, actorId, targetId } = makeIds();
    const payload = {
        companyId,
        actorId,
        action: 'EDIT_LISTING',
        targetType: 'Listing',
        targetId,
        targetName: 'Software Developer Internship'
    };
    const persisted = { _id: new mongoose.Types.ObjectId(), ...payload };
    const originalCreate = ActivityLog.create;
    let receivedPayload;

    ActivityLog.create = async (document) => {
        receivedPayload = document;
        return persisted;
    };

    try {
        const result = await activityLogger.logActivity(payload);
        assert.deepEqual(receivedPayload, payload);
        assert.equal(result, persisted);
    } finally {
        ActivityLog.create = originalCreate;
    }
});
