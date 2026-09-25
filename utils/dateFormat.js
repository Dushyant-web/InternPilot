const DEFAULT_LOCALE = 'en-IN';
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

function asValidDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeTime(value, now = new Date(), locale = DEFAULT_LOCALE) {
    const date = asValidDate(value);
    const currentTime = asValidDate(now);
    if (!date || !currentTime) return '';

    const elapsedMilliseconds = currentTime.getTime() - date.getTime();
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000));
    const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (elapsedSeconds < 60) return 'just now';
    if (elapsedSeconds < 60 * 60) return relativeTime.format(-Math.floor(elapsedSeconds / 60), 'minute');
    if (elapsedSeconds < 24 * 60 * 60) return relativeTime.format(-Math.floor(elapsedSeconds / (60 * 60)), 'hour');
    if (elapsedSeconds < 7 * 24 * 60 * 60) return relativeTime.format(-Math.floor(elapsedSeconds / (24 * 60 * 60)), 'day');
    if (elapsedSeconds < 30 * 24 * 60 * 60) return relativeTime.format(-Math.floor(elapsedSeconds / (7 * 24 * 60 * 60)), 'week');
    if (elapsedSeconds < 365 * 24 * 60 * 60) return relativeTime.format(-Math.floor(elapsedSeconds / (30 * 24 * 60 * 60)), 'month');
    return relativeTime.format(-Math.floor(elapsedSeconds / (365 * 24 * 60 * 60)), 'year');
}

function formatLocalizedDateTime(value, locale = DEFAULT_LOCALE, timeZone = DEFAULT_TIME_ZONE) {
    const date = asValidDate(value);
    if (!date) return '';

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone
    }).format(date);
}

module.exports = {
    asValidDate,
    formatRelativeTime,
    formatLocalizedDateTime
};
