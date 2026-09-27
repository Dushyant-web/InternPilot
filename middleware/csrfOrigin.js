// Cross-site request forgery guard based on the request Origin.
//
// For any state-changing request (POST/PUT/PATCH/DELETE) the browser sends an
// Origin header; if it names a different site than the one serving the app, the
// request is refused. This sits on top of the SameSite=Lax session cookie set in
// #179, as defence in depth. When neither Origin nor Referer is present (some
// non-browser clients) the request is allowed, since the SameSite cookie already
// blocks the cross-site browser case.

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(value) {
    if (!value) return null;
    try {
        return new URL(value).host;
    } catch (err) {
        return null;
    }
}

function csrfOrigin(req, res, next) {
    if (!UNSAFE.has(req.method)) return next();

    const source = hostOf(req.get('origin')) || hostOf(req.get('referer'));
    // No Origin/Referer at all: allow (covered by the SameSite cookie).
    if (!source) return next();

    const expected = req.get('host');
    if (source === expected) return next();

    if (req.xhr || req.get('accept')?.includes('application/json')) {
        return res.status(403).json({ error: 'This request was blocked because it came from a different site.' });
    }
    if (req.flash) req.flash('error_msg', 'That action was blocked for security (it looked like it came from another site). Please try again from InternPilot.');
    return res.redirect('/');
}

module.exports = csrfOrigin;
