const User = require('../models/User');

// A company owner is the Admin for its organisation. Recruiters can publish
// and review candidates, while hiring managers have read-only access.
const COMPANY_ROLES = ['company', 'recruiter', 'hiring_manager'];
const TEAM_MEMBER_ROLES = ['recruiter', 'hiring_manager'];

const COMPANY_PERMISSIONS = {
    company: [
        'dashboard:view',
        'team:manage',
        'internship:create',
        'internship:edit',
        'internship:delete',
        'applications:view',
        'applications:review'
    ],
    recruiter: [
        'dashboard:view',
        'internship:create',
        'internship:edit',
        'applications:view',
        'applications:review'
    ],
    hiring_manager: [
        'dashboard:view',
        'applications:view'
    ]
};

function companyPermissions(user) {
    if (!user || !COMPANY_ROLES.includes(user.role)) return [];
    return COMPANY_PERMISSIONS[user.role];
}

function hasCompanyPermission(user, permission) {
    return companyPermissions(user).includes(permission);
}

function deny(req, res, status, message) {
    if (req.flash) req.flash('error_msg', message);

    if (req.accepts && req.accepts(['html', 'json']) === 'json') {
        return res.status(status).json({ error: message });
    }

    return res.status(status).render('extras/error', { message, error: {} });
}

// Permission checks happen on every protected server endpoint. This protects
// against direct requests even when a button is hidden in the UI.
function requireCompanyPermission(...permissions) {
    return async (req, res, next) => {
        if (!req.user) return deny(req, res, 401, 'Please log in to access this resource.');
        if (!COMPANY_ROLES.includes(req.user.role)) {
            return deny(req, res, 403, 'This area is only available to company team members.');
        }

        // Older company-owner accounts were created before `companyId` became
        // mandatory. The owner is still the company record in that case.
        const companyId = req.user.companyId || (req.user.role === 'company' ? req.user._id : null);
        if (!companyId) {
            return deny(req, res, 403, 'This area is only available to company team members.');
        }

        if (!permissions.every(permission => hasCompanyPermission(req.user, permission))) {
            return deny(req, res, 403, 'You do not have permission to perform this action.');
        }

        try {
            const company = await User.findOne({ _id: companyId, role: 'company' });
            if (!company) {
                return deny(req, res, 403, 'Your company membership is no longer valid.');
            }

            req.company = company;
            req.companyPermissions = companyPermissions(req.user);
            return next();
        } catch (error) {
            return next(error);
        }
    };
}

function companyName(company) {
    return company.companyDetails?.companyName || company.name;
}

function companyInternshipQuery(company) {
    return {
        $or: [
            { companyId: company._id },
            // Older listings were owned through postedBy before companyId was
            // introduced. Keep them available to the same company and its team.
            { companyId: null, postedBy: company._id }
        ]
    };
}

function belongsToCompany(internship, company) {
    return Boolean(
        company?._id &&
        (
            (internship.companyId && internship.companyId.toString() === company._id.toString()) ||
            (!internship.companyId && internship.postedBy && internship.postedBy.toString() === company._id.toString())
        )
    );
}

module.exports = {
    COMPANY_ROLES,
    TEAM_MEMBER_ROLES,
    COMPANY_PERMISSIONS,
    companyPermissions,
    hasCompanyPermission,
    requireCompanyPermission,
    companyName,
    companyInternshipQuery,
    belongsToCompany
};
