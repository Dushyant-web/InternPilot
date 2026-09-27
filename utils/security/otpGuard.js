const crypto = require('crypto');

// How many wrong codes a one-time code survives before it is thrown away.
const OTP_MAX_ATTEMPTS = 5;

// Constant-time comparison, so the check doesn't leak how many digits matched.
function sameCode(expected, given) {
    const a = Buffer.from(String(expected || ''));
    const b = Buffer.from(String(given || ''));
    return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Checks and consumes a one-time code (email verification or password reset)
 * without letting parallel guesses get past the attempt limit (#194).
 *
 * 1. One attempt is reserved atomically, and only while the code exists, is
 *    unexpired and has attempts left. A guess that can't reserve an attempt
 *    is never compared.
 * 2. After the last allowed wrong attempt the code is cleared, but only if it
 *    is still the same code, so a newer code sent in the meantime survives.
 * 3. A correct code is consumed atomically, so it can't be used twice.
 *
 * Every failure (unknown email, no code, expired, used up, wrong) returns the
 * same `{ ok: false }`, so callers can reply with one neutral message and not
 * reveal whether the email has an account.
 *
 * `onSuccess` is merged into the `$set` of the consuming update.
 */
async function consumeOtp(Model, email, code, { onSuccess = {}, now = () => new Date() } = {}) {
    if (!email || !code) return { ok: false };

    const reserved = await Model.findOneAndUpdate(
        {
            email,
            otp: { $exists: true, $ne: null },
            otpExpires: { $gt: now() },
            // Missing on accounts created before this field existed.
            otpAttempts: { $not: { $gte: OTP_MAX_ATTEMPTS } }
        },
        { $inc: { otpAttempts: 1 } },
        { new: true }
    );
    if (!reserved) return { ok: false };

    if (!sameCode(reserved.otp, code)) {
        if (reserved.otpAttempts >= OTP_MAX_ATTEMPTS) {
            await Model.updateOne(
                { _id: reserved._id, otp: reserved.otp },
                { $unset: { otp: 1, otpExpires: 1 }, $set: { otpAttempts: 0 } }
            );
        }
        return { ok: false };
    }

    const user = await Model.findOneAndUpdate(
        { _id: reserved._id, otp: reserved.otp },
        { $unset: { otp: 1, otpExpires: 1, lastOtpSentAt: 1 }, $set: { otpAttempts: 0, ...onSuccess } },
        { new: true }
    );
    return user ? { ok: true, user } : { ok: false };
}

module.exports = { OTP_MAX_ATTEMPTS, consumeOtp, sameCode };
