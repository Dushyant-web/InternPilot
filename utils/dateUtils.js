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

function parseISTDatetime(datetimeString) {
    if (!datetimeString || datetimeString.trim() === '') {
        throw new Error('Interview date and time are required.');
    }
    // datetime-local sends "YYYY-MM-DDTHH:MM"
    const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
    if (!regex.test(datetimeString)) {
        throw new Error('Invalid datetime format. Expected YYYY-MM-DDTHH:MM');
    }
    // Interpret as IST (UTC+5:30) by subtracting 5:30 from the input
    const [datePart, timePart] = datetimeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);

    // Create a Date in UTC that represents this IST time
    const d = new Date(Date.UTC(year, month - 1, day, hours - 5, minutes - 30));
    if (isNaN(d.getTime())) {
        throw new Error('Invalid date/time value');
    }
    return d;
}

module.exports = { parseISTEndOfDay, parseISTDatetime };
