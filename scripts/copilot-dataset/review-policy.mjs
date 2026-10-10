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

export function isHumanApprovedRecord(record) {
  const reviewer = String(record?.review?.reviewer || "").trim();
  return record?.review?.status === "approved" &&
    !isAutomatedReviewer(reviewer) &&
    Number.isFinite(Date.parse(record?.review?.reviewed_at)) &&
    record?.permission?.review_status === "approved";
}
