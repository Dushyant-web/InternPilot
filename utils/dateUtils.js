function parseISTEndOfDay(dateString) {
    if (!dateString || dateString.trim() === '') {
        return null; // Empty input means no deadline
    }

    // Ensure format is YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
        throw new Error('Invalid deadline format. Expected YYYY-MM-DD');
    }

    const d = new Date(dateString); // Parses strictly as YYYY-MM-DDT00:00:00.000Z
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date value');
    }

    // Add 18h 29m 59s 999ms to 00:00:00 UTC
    // This perfectly equals 23:59:59.999 IST (UTC+5:30) on that same date.
    d.setUTCHours(18, 29, 59, 999);
    
    return d;
}

module.exports = { parseISTEndOfDay };
