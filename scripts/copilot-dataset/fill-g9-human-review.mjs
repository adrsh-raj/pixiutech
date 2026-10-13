#!/usr/bin/env node

// Permanently disabled: this legacy script manufactured bulk "Approved"
// decisions and templated evidence notes. It was not independent human review.
console.error("BLOCKED: fill-g9-human-review.mjs is unsafe and intentionally disabled.");
console.error("Export the G9 workbook, enter genuine owner decisions, then use the guarded importer.");
console.error("No records, workbooks or reports were modified; no approvals were created.");
process.exitCode = 1;
