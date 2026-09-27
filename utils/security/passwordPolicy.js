// A small, dependency-free password strength check used on sign-up and password
// reset. It rejects short passwords, the account's own email, and a short list
// of very common passwords. It is deliberately light so it doesn't frustrate
// real users, while stopping the worst choices.

const MIN_LENGTH = 8;

// A compact set of the most common weak passwords. Not exhaustive by design;
// the length and email checks do most of the work.
const COMMON = new Set([
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty', 'qwerty123', 'qwertyuiop', '111111', '123123', '000000', 'abc12345',
    'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein1', 'internpilot',
    'football', 'monkey12', 'dragon123', 'sunshine', 'princess', 'passw0rd'
]);

/**
 * Returns null when the password is acceptable, otherwise a short message
 * explaining what to fix.
 */
function validatePassword(password, email = '') {
    const value = typeof password === 'string' ? password : '';
    if (value.length < MIN_LENGTH) {
        return `Password must be at least ${MIN_LENGTH} characters long.`;
    }
    if (value.length > 200) {
        return 'Password is too long.';
    }
    const lower = value.toLowerCase();
    if (COMMON.has(lower)) {
        return 'That password is too common. Please choose something harder to guess.';
    }
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (normalizedEmail) {
        const localPart = normalizedEmail.split('@')[0];
        if (lower === normalizedEmail || (localPart.length >= 4 && lower === localPart)) {
            return 'Password must not be the same as your email address.';
        }
    }
    return null;
}

module.exports = { validatePassword, MIN_LENGTH };
