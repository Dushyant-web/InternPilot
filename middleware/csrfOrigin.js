// Cross-site request forgery guard based on the request Origin.
//
// For any state-changing request (POST/PUT/PATCH/DELETE) the browser sends an
// Origin header; if it names a different site than the one serving the app, the
// request is refused. This sits on top of the SameSite=Lax session cookie set in
// #179, as defence in depth.
//
// - Origin present: it must match this site. "null" (sandboxed iframes, data:
//   pages, some cross-origin redirects) is never trusted.
// - Origin absent: fall back to Referer when present, which must match too.
// - Neither header: allowed. Browsers always send Origin on these requests, so
//   this is a non-browser client, and the SameSite cookie still covers browsers.

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(value) {
    if (!value) return null;
    try {
        return new URL(value).host || null;
    } catch (err) {
        return null;
    }
}

// Hosts this request may legitimately come from. Behind a trusted proxy the
// public host can arrive in X-Forwarded-Host.
function allowedHosts(req) {
    const hosts = new Set();
    if (req.get('host')) hosts.add(req.get('host'));
    const trustsProxy = req.app && typeof req.app.get === 'function' && req.app.get('trust proxy');
    const forwarded = req.get('x-forwarded-host');
    if (trustsProxy && forwarded) hosts.add(forwarded.split(',')[0].trim());
    return hosts;
}

function reject(req, res) {
    if (req.xhr || req.get('accept')?.includes('application/json')) {
        return res.status(403).json({ error: 'This request was blocked because it came from a different site.' });
    }
    if (req.flash) req.flash('error_msg', 'That action was blocked for security (it looked like it came from another site). Please try again from InternPilot.');
    return res.redirect('/');
}

function csrfOrigin(req, res, next) {
    if (!UNSAFE.has(req.method)) return next();

    const origin = req.get('origin');
    const referer = req.get('referer');
    if (origin === undefined && !referer) return next();

    // An Origin header, even "null", is decisive; otherwise use the Referer.
    const source = origin !== undefined ? hostOf(origin) : hostOf(referer);
    if (source && allowedHosts(req).has(source)) return next();
    return reject(req, res);
}

module.exports = csrfOrigin;
