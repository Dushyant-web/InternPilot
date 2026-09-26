const SAFE_HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns a normalized HTTP(S) URL, or an error when the value is not safe to
 * use as a link.  URLs are deliberately required to include their scheme so a
 * value such as `javascript:...` is never transformed into a seemingly valid
 * URL by a caller that prepends `https://`.
 *
 * @param {unknown} value
 * @returns {{ url: string, error?: string }}
 */
function sanitizeHttpUrl(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return { url: '' };

    try {
        const parsed = new URL(raw);
        if (!SAFE_HTTP_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
            return { url: '', error: 'Meeting link must be a valid http:// or https:// URL.' };
        }

        return { url: parsed.toString() };
    } catch {
        return { url: '', error: 'Meeting link must be a valid http:// or https:// URL.' };
    }
}

function isSafeHttpUrl(value) {
    return Boolean(sanitizeHttpUrl(value).url);
}

module.exports = {
    sanitizeHttpUrl,
    isSafeHttpUrl
};
