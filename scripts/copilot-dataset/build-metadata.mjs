/**
 * Stable timestamps for reproducible Phase 2 dataset artifacts.
 * Set SOURCE_DATE_EPOCH to pin a release-build timestamp explicitly.
 */
import { execSync } from "node:child_process"
export function getBuildTimestamp() {
  const epoch = process.env.SOURCE_DATE_EPOCH
  if (epoch && /^\d+$/.test(epoch)) return new Date(Number(epoch) * 1000).toISOString()
  try {
    const value = execSync("git log -1 --format=%cI", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
    const parsed = new Date(value)
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  } catch {}
  return "1970-01-01T00:00:00.000Z"
}
