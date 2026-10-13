/**
 * Human-review policy for release gates. Generator/verifier labels are evidence
 * of automation, not evidence of an independent human approving a gold record.
 */
export function isAutomatedReviewer(reviewer) {
  const value = String(reviewer || "").trim().toLowerCase();
  if (!value) return true;
  return value === "system-qa-curator" || value === "controlled-mutation-engine" ||
    /(?:^system-|generator|verifier|automation|automated|(?:^|[-_])bot(?:$|[-_]))/i.test(value);
}

/**
 * The historical bulk-fill script generated 867 nominal approvals under
 * adrsh-lead-reviewer between 16:30 UTC and 23:00:07 UTC on 2026-10-10.
 * That exact signature is retracted. Later, individually entered and imported
 * owner reviews remain eligible, even when the same reviewer ID is used.
 */
export function isHistoricalBulkApproval(record) {
  const reviewer = String(record?.review?.reviewer || "").trim().toLowerCase();
  const timestamp = Date.parse(record?.review?.reviewed_at);
  return reviewer === "adrsh-lead-reviewer" &&
    Number.isFinite(timestamp) &&
    timestamp >= Date.parse("2026-10-10T16:30:00.000Z") &&
    timestamp <= Date.parse("2026-10-10T23:00:07.000Z");
}

export function isHumanApprovedRecord(record) {
  const reviewer = String(record?.review?.reviewer || "").trim();
  return record?.review?.status === "approved" &&
    !isAutomatedReviewer(reviewer) &&
    !isHistoricalBulkApproval(record) &&
    Number.isFinite(Date.parse(record?.review?.reviewed_at)) &&
    record?.permission?.review_status === "approved";
}
