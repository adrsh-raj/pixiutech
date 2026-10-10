/**
 * Shared Phase 2 content-hash contract. Release validation and repair use this
 * single implementation so the producer and verifier cannot drift silently.
 */
import { sha256 } from "./normalize-record.mjs";
export function expectedContentHash(record) {
  if (!record || typeof record !== "object") return null;
  if (record.task_type === "request_to_circuit") return sha256({ text: record.instruction.text, target: record.target });
  if (record.task_type === "fault_repair") return sha256({
    fault: record.fault.input_circuit,
    target: { circuit: record.target.corrected_circuit, explanation: record.target.explanation, code: record.target.code },
    mutation_id: record.fault.mutation_id,
  });
  if (record.task_type === "diagnosis_explanation") return sha256({
    circuit: record.target.circuit, explanation: record.target.explanation,
    instruction: record.instruction.text, task: "diagnosis_explanation",
  });
  if (record.task_type === "blockly_code") return sha256({
    circuit: record.target.circuit, code: record.target.code,
    instruction: record.instruction.text, task: "blockly_code",
  });
  return null;
}
export function expectedCanonicalContentHash(record) {
  if (!record?.target) return null;
  return sha256({ circuit: record.target.circuit, explanation: record.target.explanation, code: record.target.code });
}
export function withExpectedContentHash(record) {
  const contentHash = expectedContentHash(record);
  if (!contentHash) throw new Error("Unsupported task type for content hash: " + String(record?.task_type));
  return { ...record, hashes: { ...(record.hashes || {}), content_hash: contentHash } };
}
export function withExpectedCanonicalContentHash(record) {
  const contentHash = expectedCanonicalContentHash(record);
  if (!contentHash) throw new Error("Cannot compute canonical hash for " + String(record?.record_id));
  return { ...record, hashes: { ...(record.hashes || {}), content_hash: contentHash } };
}
