// Response headers that harden the app against clickjacking, MIME sniffing and
// referrer leakage. These are intentionally conservative: only frame-ancestors
// is set for CSP so the existing CDN scripts and styles (Tailwind, Chart.js,
// phosphor, Google Fonts, Monaco) keep working. Camera and microphone stay
// allowed for our own pages because the mock interview uses them.

function securityHeaders(isProduction = process.env.NODE_ENV === 'production') {
    return function securityHeadersMiddleware(req, res, next) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        if (isProduction) {
            res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        }
        next();
    };
}

module.exports = securityHeaders;
