const { parseISTEndOfDay } = require('../utils/dateUtils');

console.log("--- TEST 1: Stored Date is 23:59:59.999 IST ---");
const deadline = parseISTEndOfDay('2026-10-15');
console.log("Parsed Date UTC:", deadline.toISOString());
console.log("Expected: 2026-10-15T18:29:59.999Z");

console.log("\n--- TEST 2: Display Date ---");
const displayStr = deadline.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
console.log("Displayed as:", displayStr);

console.log("\n--- TEST 3 & 4: Application Boundary Check ---");
const pastDeadline = parseISTEndOfDay('2020-01-01');
const futureDeadline = parseISTEndOfDay('2099-12-31');
const now = new Date();

console.log("Application before deadline (future):", (futureDeadline && now > futureDeadline) ? "Rejected" : "Accepted");
console.log("Application after deadline (past):", (pastDeadline && now > pastDeadline) ? "Rejected" : "Accepted");

console.log("\n--- TEST 5: Frontend Display Logic ---");
console.log("Frontend UI for past deadline closed check:", now > pastDeadline);
console.log("Frontend UI for future deadline closed check:", now > futureDeadline);

console.log("\n--- TEST 8: Invalid Deadline Handling ---");
try {
    parseISTEndOfDay('invalid-date-string');
    console.log("FAILED: Invalid date was accepted.");
} catch (e) {
    console.log("SUCCESS: Invalid date threw error:", e.message);
}

console.log("\n--- TEST 9: No Deadline Handling ---");
const noDeadline = parseISTEndOfDay('');
console.log("No deadline parsed as:", noDeadline);
console.log("Application logic with no deadline:", (noDeadline && now > noDeadline) ? "Rejected" : "Accepted (skips check)");

console.log("\n--- TEST 11: Edit Modal Date Prepopulation ---");
console.log("Date for input[type=date]:", deadline.toISOString().split('T')[0]);
