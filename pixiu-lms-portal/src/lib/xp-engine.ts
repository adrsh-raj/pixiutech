/**
 * PIXIU XP & Gamification Engine
 * 
 * Provides an event-sourced, tamper-resilient, cross-surface XP & Leveling system
 * for students across the Simulation CyberLab and Student Portal.
 * 
 * Features:
 * - 4-Pillar XP Model (Curriculum Missions, Custom Creation, Daily Consistency, Multimodal/AI Bonus)
 * - Cryptographic FNV-1a checksum signatures to prevent localStorage manipulation
 * - Cloud-Backed Synchronization with Pixiu backend (Zero data loss if localStorage is cleared)
 * - Role-Aware Isolation: Students earn XP; Admins & Trainers operate in Sandbox Mode (XP Disabled)
 * - Per-student scoped ledgers + guest offline persistence
 * - Idempotent event keys to prevent spamming/re-granting
 * - Daily XP caps (500 XP / day) against auto-clickers/bots
 * - Multi-surface synchronization between Circuit Lab and Student Portal
 * - Live School-wise & Class-wise Leaderboard aggregation
 */

import type { CircuitState } from "./circuit-types"
import { apiFetch } from "@/context/AuthContext"
import { isBoardPart } from "./board-registry"
import { TEMPLATES } from "./templates"
import { LESSONS } from "./lesson-engine"

export const XP_STORAGE_KEY = "pixiu_xp_ledger_v2"
export const XP_UPDATE_EVENT = "pixiu_xp_updated"
export const XP_SYNC_EVENT = "pixiu_xp_synced"
export const DAILY_XP_CAP = 500

export type XpCategory = "mission" | "creation" | "tinkering" | "streak" | "bonus"

export interface XpEvent {
  id: string
  category: XpCategory
  title: string
  xp: number
  timestamp: number
  metadata?: Record<string, unknown>
  signature: string
}

export interface XpLedger {
  version: 2
  events: XpEvent[]
  lastActiveDate: string
  streakDays: number
  salt: string
}

export interface XpLevelInfo {
  level: number
  title: string
  icon: string
  badge: string
  minXp: number
  maxXp: number
  color: string
  bgGlow: string
}

export const XP_LEVELS: XpLevelInfo[] = [
  { level: 1, title: "Circuit Novice", icon: "🔌", badge: "Novice", minXp: 0, maxXp: 300, color: "text-emerald-400", bgGlow: "from-emerald-500/20 to-transparent" },
  { level: 2, title: "Logic Wireman", icon: "⚙️", badge: "Wireman", minXp: 300, maxXp: 900, color: "text-cyan-400", bgGlow: "from-cyan-500/20 to-transparent" },
  { level: 3, title: "Sensor Explorer", icon: "📡", badge: "Explorer", minXp: 900, maxXp: 1800, color: "text-amber-400", bgGlow: "from-amber-500/20 to-transparent" },
  { level: 4, title: "Robotics Builder", icon: "🤖", badge: "Builder", minXp: 1800, maxXp: 3200, color: "text-blue-400", bgGlow: "from-blue-500/20 to-transparent" },
  { level: 5, title: "AI Hardware Architect", icon: "🧠", badge: "Architect", minXp: 3200, maxXp: 5000, color: "text-purple-400", bgGlow: "from-purple-500/20 to-transparent" },
  { level: 6, title: "Grandmaster Innovator", icon: "🏆", badge: "Grandmaster", minXp: 5000, maxXp: 100000, color: "text-yellow-400", bgGlow: "from-yellow-500/20 to-transparent" },
]

export interface XpSummary {
  totalXp: number
  level: number
  levelInfo: XpLevelInfo
  currentLevelXp: number
  nextLevelXp: number
  progressPercent: number
  todayXp: number
  dailyCapRemaining: number
  streakDays: number
  totalMissionsCompleted: number
  totalCreationsSaved: number
  events: XpEvent[]
  badges: string[]
  cloudSynced: boolean
  lastSyncedAt?: number
  isSandbox: boolean
  userRole: string | null
  isMaxLevel: boolean
}

const SECRET_SALT = "pixiu_cyberlab_anti_tamper_salt_2026"
let activeStudentId: string | null = null
let inMemoryRole: string | null = null
let syncTimeout: number | null = null
let lastSyncTimestamp: number = 0
let isSyncInProgress = false
let hasPendingSyncRequest = false

function fnv1a(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

function generateSignature(event: Omit<XpEvent, "signature">, salt: string): string {
  const payload = `${event.id}:${event.category}:${event.xp}:${event.timestamp}:${salt}:${SECRET_SALT}`
  return fnv1a(payload)
}

/**
 * Returns UTC calendar date YYYY-MM-DD for consistent cross-timezone daily aggregation.
 */
function getTodayKey(): string {
  return new Date().toISOString().split("T")[0]
}

function getDeviceSalt(): string {
  if (typeof window === "undefined") return "server"
  try {
    let salt = window.localStorage.getItem("pixiu_device_salt")
    if (!salt) {
      salt = Math.random().toString(36).substring(2) + Date.now().toString(36)
      window.localStorage.setItem("pixiu_device_salt", salt)
    }
    return salt
  } catch {
    return "fallback_salt"
  }
}

export function setUserRole(role: string | null) {
  inMemoryRole = role ? String(role).trim().toLowerCase() : null
}

export function getUserRole(): string | null {
  if (typeof window === "undefined") return null
  try {
    const role = window.sessionStorage.getItem("pixiu_session_role")
    if (role) return role.trim().toLowerCase()
  } catch {
    // Session storage not accessible
  }
  return inMemoryRole
}

/**
 * Returns true if the user is a student or unauthenticated guest.
 * Returns false if the user is an Administrator, SuperAdmin, Trainer, or School.
 */
export function isStudentUser(): boolean {
  const role = getUserRole()
  // Unauthenticated guests in standalone simulator can tinker locally
  if (!role) return true
  return role === "student"
}

export function setActiveStudentId(studentId: string | null) {
  activeStudentId = studentId ? String(studentId).trim().toUpperCase() : null
  if (typeof window !== "undefined" && activeStudentId) {
    try {
      const studentKey = `${XP_STORAGE_KEY}_${activeStudentId}`
      const studentData = window.localStorage.getItem(studentKey)
      const genericData = window.localStorage.getItem(XP_STORAGE_KEY)
      // Only migrate generic offline progress if the student key is completely fresh
      if (!studentData && genericData) {
        window.localStorage.setItem(studentKey, genericData)
      }
    } catch {
      // Storage unavailable
    }
  }
}

export function getActiveStudentId(): string | null {
  if (activeStudentId) return activeStudentId
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem("pixiu_session_student_id")
      if (stored) return stored.trim().toUpperCase()
    } catch {}
  }
  return null
}

function syncXpIdentityFromSession() {
  if (typeof window === "undefined") return
  try {
    const role = window.sessionStorage.getItem("pixiu_session_role")
    const studentId = window.sessionStorage.getItem("pixiu_session_student_id")
    setUserRole(role)
    setActiveStudentId(role?.trim().toLowerCase() === "student" ? studentId : null)
  } catch {
    setUserRole(null)
    setActiveStudentId(null)
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pixiu_auth_state_changed", syncXpIdentityFromSession)
  window.addEventListener("storage", (event) => {
    if (event.key === "pixiu_portal_logout_at" && event.newValue) {
      setUserRole(null)
      setActiveStudentId(null)
    }
  })
  syncXpIdentityFromSession()
}

export function getXpStorageKey(studentId?: string | null): string {
  const role = getUserRole()
  // Non-students (admin/trainer) have their own isolated sandbox storage key
  if (role && role !== "student") {
    return `${XP_STORAGE_KEY}_${role}_sandbox`
  }
  const sid = studentId ? String(studentId).trim().toUpperCase() : activeStudentId
  return sid ? `${XP_STORAGE_KEY}_${sid}` : XP_STORAGE_KEY
}

export function loadXpLedger(studentId?: string | null): XpLedger {
  const salt = getDeviceSalt()
  const defaultLedger: XpLedger = {
    version: 2,
    events: [],
    lastActiveDate: getTodayKey(),
    streakDays: 0,
    salt,
  }

  if (typeof window === "undefined") return defaultLedger

  try {
    const key = getXpStorageKey(studentId)
    let raw = window.localStorage.getItem(key)
    // Only fall back to generic key if NOT authenticated as a specific student
    if (!raw && key === XP_STORAGE_KEY && isStudentUser()) {
      raw = window.localStorage.getItem(XP_STORAGE_KEY)
    }
    if (!raw) return defaultLedger

    const parsed = JSON.parse(raw) as Partial<XpLedger>
    if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.events)) {
      return defaultLedger
    }

    // Validate signatures to detect any manual localStorage tampering
    const validEvents = parsed.events.filter((evt) => {
      if (!evt || typeof evt.id !== "string" || typeof evt.xp !== "number") return false
      const expected = generateSignature(evt, parsed.salt || salt)
      return evt.signature === expected
    })

    return {
      version: 2,
      events: validEvents,
      lastActiveDate: typeof parsed.lastActiveDate === "string" ? parsed.lastActiveDate : getTodayKey(),
      streakDays: typeof parsed.streakDays === "number" ? parsed.streakDays : 0,
      salt: parsed.salt || salt,
    }
  } catch {
    return defaultLedger
  }
}

export function saveXpLedger(
  ledger: XpLedger,
  studentId?: string | null,
  options?: { skipSync?: boolean },
) {
  if (typeof window === "undefined") return
  try {
    const key = getXpStorageKey(studentId)
    const jsonStr = JSON.stringify(ledger)
    window.localStorage.setItem(key, jsonStr)

    // Mirror to generic fallback ONLY for offline/unauthenticated guests
    if (key === XP_STORAGE_KEY && !studentId && !activeStudentId && isStudentUser()) {
      window.localStorage.setItem(XP_STORAGE_KEY, jsonStr)
    }

    window.dispatchEvent(new CustomEvent(XP_UPDATE_EVENT, { detail: getXpSummary(ledger) }))

    if (!options?.skipSync) {
      scheduleXpSync()
    }
  } catch {
    // Best effort local persistence
  }
}

export function getXpLevel(totalXp: number): XpLevelInfo {
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= XP_LEVELS[i].minXp) {
      return XP_LEVELS[i]
    }
  }
  return XP_LEVELS[0]
}

export function getXpSummary(ledger?: XpLedger): XpSummary {
  const role = getUserRole()
  const isSandbox = !isStudentUser()

  // If in admin/trainer sandbox mode, return a clean sandbox profile with 0 XP
  if (isSandbox) {
    return {
      totalXp: 0,
      level: 1,
      levelInfo: XP_LEVELS[0],
      currentLevelXp: 0,
      nextLevelXp: 300,
      progressPercent: 0,
      todayXp: 0,
      dailyCapRemaining: DAILY_XP_CAP,
      streakDays: 0,
      totalMissionsCompleted: 0,
      totalCreationsSaved: 0,
      events: [],
      badges: [],
      cloudSynced: false,
      isSandbox: true,
      userRole: role,
      isMaxLevel: false,
    }
  }

  const currentLedger = ledger || loadXpLedger()
  const today = getTodayKey()

  let totalXp = 0
  let todayXp = 0
  const dailyTotals: Record<string, number> = {}

  let totalMissions = 0
  let totalCreations = 0

  for (const evt of currentLedger.events) {
    const evtDate = new Date(evt.timestamp).toISOString().split("T")[0]
    const dayTotal = dailyTotals[evtDate] || 0

    // Only count XP up to the daily cap
    const allowedXp = Math.min(evt.xp, Math.max(0, DAILY_XP_CAP - dayTotal))
    if (allowedXp > 0) {
      dailyTotals[evtDate] = dayTotal + allowedXp
      totalXp += allowedXp
      if (evtDate === today) {
        todayXp += allowedXp
      }
    }

    if (evt.category === "mission") totalMissions++
    if (evt.category === "creation") totalCreations++
  }

  const levelInfo = getXpLevel(totalXp)
  const isMaxLevel = levelInfo.level === XP_LEVELS[XP_LEVELS.length - 1].level
  const nextLevel = XP_LEVELS.find((l) => l.level === levelInfo.level + 1)
  const currentLevelMin = levelInfo.minXp
  const nextLevelMin = nextLevel ? nextLevel.minXp : totalXp

  const levelXpSpan = Math.max(1, (nextLevel ? nextLevel.minXp : levelInfo.maxXp) - currentLevelMin)
  const progressInLevel = Math.max(0, totalXp - currentLevelMin)
  const progressPercent = isMaxLevel ? 100 : Math.min(100, Math.round((progressInLevel / levelXpSpan) * 100))

  // Inactive streak detection: if no activity in last 1 day, active streak is 0
  const curTime = new Date(`${today}T00:00:00Z`).getTime()
  const lastTime = currentLedger.lastActiveDate ? new Date(`${currentLedger.lastActiveDate}T00:00:00Z`).getTime() : 0
  const daysSinceActive = Math.round((curTime - lastTime) / (1000 * 60 * 60 * 24))
  const effectiveStreak = daysSinceActive <= 1 ? (currentLedger.streakDays || 0) : 0

  // Badges collection
  const badges: string[] = []
  if (totalMissions >= 1) badges.push("🔌 First Blink")
  if (totalMissions >= 5) badges.push("⚙️ Logic Master")
  if (totalMissions >= 10) badges.push("📡 Sensor Pro")
  if (totalMissions >= 18) badges.push("🚗 AI Pioneer")
  if (totalCreations >= 1) badges.push("🎨 Creator")
  if (totalCreations >= 5) badges.push("🚀 Master Architect")
  if (effectiveStreak >= 3) badges.push("🔥 3-Day Streak")
  if (effectiveStreak >= 7) badges.push("⚡ 7-Day Champion")

  return {
    totalXp,
    level: levelInfo.level,
    levelInfo,
    currentLevelXp: progressInLevel,
    nextLevelXp: nextLevelMin,
    progressPercent,
    todayXp,
    dailyCapRemaining: Math.max(0, DAILY_XP_CAP - todayXp),
    streakDays: effectiveStreak,
    totalMissionsCompleted: totalMissions,
    totalCreationsSaved: totalCreations,
    events: [...currentLedger.events].reverse(),
    badges,
    cloudSynced: lastSyncTimestamp > 0,
    lastSyncedAt: lastSyncTimestamp,
    isSandbox: false,
    userRole: role,
    isMaxLevel,
  }
}

/**
 * Grants XP for an event if not already rewarded and not exceeding daily cap.
 * Admins, Trainers, and Staff run in Sandbox Mode and do not earn student XP.
 */
export function awardXp(
  id: string,
  category: XpCategory,
  title: string,
  baseXp: number,
  metadata?: Record<string, unknown>,
): boolean {
  if (typeof window === "undefined") return false

  // Strictly block XP awarding for Admin, Trainer, and School staff
  if (!isStudentUser()) {
    return false
  }

  const ledger = loadXpLedger()

  // Idempotency: Check if this specific event ID was already awarded
  if (ledger.events.some((e) => e.id === id)) {
    return false
  }

  // Check today's cap
  const today = getTodayKey()
  const todayEvents = ledger.events.filter((e) => new Date(e.timestamp).toISOString().split("T")[0] === today)
  const todayTotal = todayEvents.reduce((acc, e) => acc + e.xp, 0)
  if (todayTotal >= DAILY_XP_CAP) {
    return false
  }

  const allowedXp = Math.min(baseXp, DAILY_XP_CAP - todayTotal)
  if (allowedXp <= 0) return false

  const newEventWithoutSig: Omit<XpEvent, "signature"> = {
    id,
    category,
    title,
    xp: allowedXp,
    timestamp: Date.now(),
    metadata,
  }

  const signature = generateSignature(newEventWithoutSig, ledger.salt)
  const newEvent: XpEvent = {
    ...newEventWithoutSig,
    signature,
  }

  // Robust calendar-day streak computation
  if (ledger.lastActiveDate !== today) {
    const curTime = new Date(`${today}T00:00:00Z`).getTime()
    const lastTime = ledger.lastActiveDate ? new Date(`${ledger.lastActiveDate}T00:00:00Z`).getTime() : 0
    const diffDays = Math.round((curTime - lastTime) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      ledger.streakDays = (ledger.streakDays || 0) + 1
    } else {
      ledger.streakDays = 1
    }
    ledger.lastActiveDate = today
  } else if (!ledger.streakDays) {
    ledger.streakDays = 1
  }

  ledger.events.push(newEvent)
  saveXpLedger(ledger)
  return true
}

/**
 * Award XP for completing an interactive curriculum mission
 */
export function awardMissionXp(
  lessonId: string,
  difficulty: "Beginner" | "Intermediate" | "Advanced" | string,
  title: string,
): boolean {
  if (!isStudentUser()) return false
  const points = difficulty === "Beginner" ? 50 : difficulty === "Intermediate" ? 100 : difficulty === "Advanced" ? 200 : 50
  return awardXp(`mission:${lessonId}`, "mission", `Completed ${title}`, points, { lessonId, difficulty })
}

export function normalizePinId(pin: string): string {
  let p = String(pin || "").toLowerCase().trim()
  p = p.replace(/^(gpio|gp|d|p)/i, "")
  if (["vcc", "5v", "3v3", "3.3v", "3v", "vin", "power"].includes(p)) return "vcc"
  if (["gnd", "gnd_l", "gnd_r", "gnd_1", "ground", "neg", "0v", "gnd_edge", "gnd_pwr"].includes(p) || p.startsWith("gnd_")) return "gnd"
  if (["anode", "a", "pos", "+"].includes(p)) return "anode"
  if (["cathode", "k", "c", "neg", "-"].includes(p)) return "cathode"
  if (["terminal1", "terminal2", "t1", "t2", "a", "b"].includes(p)) return "terminal"
  return p
}

export interface CircuitNetlistSignature {
  partTypes: string[]
  wires: string[]
}

export function extractCircuitSignature(circuit: CircuitState): CircuitNetlistSignature {
  if (!circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) {
    return { partTypes: [], wires: [] }
  }

  const partTypeMap = new Map<string, string>()
  const partTypes: string[] = []

  for (const part of circuit.parts) {
    if (!part?.id || !part?.type) continue
    partTypeMap.set(part.id, part.type)
    partTypes.push(part.type)
  }
  partTypes.sort()

  const wires: string[] = []
  for (const wire of circuit.wires) {
    if (!wire?.from?.partId || !wire?.to?.partId) continue
    const typeFrom = partTypeMap.get(wire.from.partId)
    const typeTo = partTypeMap.get(wire.to.partId)
    if (!typeFrom || !typeTo) continue

    const pinFrom = normalizePinId(wire.from.pinId || "")
    const pinTo = normalizePinId(wire.to.pinId || "")

    const epA = `${typeFrom}:${pinFrom}`
    const epB = `${typeTo}:${pinTo}`
    wires.push(epA < epB ? `${epA}<->${epB}` : `${epB}<->${epA}`)
  }
  wires.sort()

  return { partTypes, wires }
}

export function isDerivativeCircuit(
  candidate: CircuitState | CircuitNetlistSignature,
  reference: CircuitState | CircuitNetlistSignature,
): boolean {
  const sigA = "partTypes" in candidate && "wires" in candidate ? candidate : extractCircuitSignature(candidate as CircuitState)
  const sigB = "partTypes" in reference && "wires" in reference ? reference : extractCircuitSignature(reference as CircuitState)

  if (sigA.partTypes.length === 0 || sigB.partTypes.length === 0) return false
  if (sigA.wires.length === 0 || sigB.wires.length === 0) return false

  // Compare Part Types multiset
  const partsA = [...sigA.partTypes]
  const partsB = [...sigB.partTypes]

  let matchedParts = 0
  for (const pt of partsA) {
    const idx = partsB.indexOf(pt)
    if (idx !== -1) {
      matchedParts++
      partsB.splice(idx, 1)
    }
  }
  const maxPartCount = Math.max(sigA.partTypes.length, sigB.partTypes.length)
  const partSimilarity = maxPartCount > 0 ? matchedParts / maxPartCount : 0

  if (partSimilarity < 0.7) {
    return false
  }

  // Compare Wire Connections
  const wiresA = new Set(sigA.wires)
  const wiresB = new Set(sigB.wires)

  let commonWires = 0
  for (const w of wiresA) {
    if (wiresB.has(w)) {
      commonWires++
    }
  }

  const maxWires = Math.max(wiresA.size, wiresB.size)
  const wireOverlapRatio = maxWires > 0 ? commonWires / maxWires : 0
  const diffConnections = maxWires - commonWires

  // Rule 1: High part similarity with 1 or 2 wire difference (e.g. user just shifted pin D10 -> D11)
  if (partSimilarity >= 0.8 && (diffConnections <= 2 || wireOverlapRatio >= 0.6)) {
    return true
  }

  // Rule 2: High wire overlap
  if (wireOverlapRatio >= 0.75) {
    return true
  }

  return false
}

let cachedReferenceSignatures: { id: string; name: string; signature: CircuitNetlistSignature }[] | null = null

export function getReferenceSignatures(): { id: string; name: string; signature: CircuitNetlistSignature }[] {
  if (cachedReferenceSignatures) return cachedReferenceSignatures

  const refs: { id: string; name: string; signature: CircuitNetlistSignature }[] = []

  if (Array.isArray(TEMPLATES)) {
    for (const t of TEMPLATES) {
      if (t?.circuit && Array.isArray(t.circuit.parts) && t.circuit.parts.length >= 2) {
        refs.push({
          id: t.id,
          name: t.name || t.id,
          signature: extractCircuitSignature(t.circuit),
        })
      }
    }
  }

  if (Array.isArray(LESSONS)) {
    for (const l of LESSONS) {
      if (l?.seedCircuit && Array.isArray(l.seedCircuit.parts) && l.seedCircuit.parts.length >= 2) {
        refs.push({
          id: l.id,
          name: l.title || l.id,
          signature: extractCircuitSignature(l.seedCircuit),
        })
      }
    }
  }

  cachedReferenceSignatures = refs
  return refs
}

export interface CreationXpOptions {
  activeTemplateId?: string | null
  isMission?: boolean
}

/**
 * Award XP for saving a verified custom circuit
 */
export function awardCreationXp(
  circuit: CircuitState,
  blocklyXml: string,
  projectName: string,
  options?: CreationXpOptions,
): boolean {
  if (!isStudentUser() || !circuit || !Array.isArray(circuit.parts) || !Array.isArray(circuit.wires)) return false

  // Anti-Cheat Guard 1: Mission-named or active mission circuits do not earn Creation XP
  const cleanName = (projectName || "").trim()
  const isMission = Boolean(options?.isMission) || cleanName.startsWith("Mission ·") || cleanName.toLowerCase().startsWith("mission ")
  if (isMission) {
    return false
  }

  // Anti-Cheat Guard 2: Active loaded templates do not earn Creation XP
  if (options?.activeTemplateId) {
    return false
  }

  const controllerCount = circuit.parts.filter((p) => isBoardPart(p.type)).length
  const totalParts = circuit.parts.length
  const totalWires = circuit.wires.length

  if (controllerCount < 1 || totalParts < 3 || totalWires < 2) {
    return false
  }

  // Anti-Cheat Guard 3: Algorithmic Derivation Check
  // Rejects circuits cloned from pre-built templates or lessons, including single-pin mutations (e.g. D10 -> D11)
  const candidateSig = extractCircuitSignature(circuit)
  const references = getReferenceSignatures()

  for (const ref of references) {
    if (isDerivativeCircuit(candidateSig, ref.signature)) {
      return false
    }
  }

  const partTypes = circuit.parts.map((p) => p.type).sort().join(",")
  
  // Canonical bidirectional wire sorting to avoid hash duplicates
  const wireNet = circuit.wires
    .filter((w) => w?.from?.partId && w?.to?.partId)
    .map((w) => {
      const a = `${w.from.partId}:${w.from.pinId}`
      const b = `${w.to.partId}:${w.to.pinId}`
      return a < b ? `${a}<->${b}` : `${b}<->${a}`
    })
    .sort()
    .join(";")

  const circuitHash = fnv1a(`${partTypes}|${wireNet}`)

  let basePoints = 75
  const xmlSafe = typeof blocklyXml === "string" ? blocklyXml : ""
  const hasAi = xmlSafe.includes('type="ai_') || circuit.parts.some((p) => p.type === "servo" && p.props?.arm === "barrier")
  const hasDisplay = circuit.parts.some((p) => p.type === "lcd-i2c" || p.type === "oled-i2c" || p.type === "neopixel-ring" || p.type === "seven-segment")
  const hasSensor = circuit.parts.some((p) => ["ultrasonic", "ldr", "tmp36", "dht11", "mq2-gas", "soil-moisture", "pir-sensor"].includes(p.type))

  if (hasAi) basePoints += 100
  if (hasDisplay && hasSensor) basePoints += 50

  const awarded = awardXp(`circuit:${circuitHash}`, "creation", `Built Custom Circuit: ${projectName || "Project"}`, basePoints, {
    partTypes,
    hasAi,
    hasDisplay,
    hasSensor,
  })

  // Trigger background creation backup to student profile
  if (awarded) {
    void syncXpWithServer(activeStudentId, {
      newCreation: {
        name: projectName || "Custom Circuit",
        summary: `Verified circuit with ${totalParts} components and ${totalWires} connections. Hash: ${circuitHash}`,
      },
    })
  }

  return awarded
}

/**
 * Award XP for active simulation interactive experimentation
 */
export function awardTinkeringXp(): boolean {
  if (!isStudentUser()) return false
  const today = getTodayKey()
  const intervalIndex = Math.floor(Date.now() / (1000 * 60 * 5)) // 5 minute slot
  return awardXp(`tinker:${today}:${intervalIndex}`, "tinkering", "Active Circuit Simulation & Testing", 10)
}

/**
 * Schedule a debounced cloud sync (1200ms)
 */
export function scheduleXpSync() {
  if (typeof window === "undefined" || !isStudentUser()) return
  if (syncTimeout) {
    window.clearTimeout(syncTimeout)
  }
  syncTimeout = window.setTimeout(() => {
    syncTimeout = null
    void syncXpWithServer()
  }, 1200)
}

/**
 * Cloud-Backed Synchronization
 * 
 * If localStorage was cleared, this fetches the authoritative ledger from backend and re-hydrates local storage.
 * If local ledger has newer events, it pushes them to the server to ensure zero progress loss.
 * Admins and Trainers do not push to student XP endpoints.
 */
export async function syncXpWithServer(
  studentId?: string | null,
  options?: {
    forceFetch?: boolean
    newCreation?: { name: string; summary: string }
  },
): Promise<XpSummary | null> {
  if (typeof window === "undefined") return null

  // If sync already in progress, remember request and execute immediately after
  if (isSyncInProgress) {
    hasPendingSyncRequest = true
    return getXpSummary()
  }

  // Admin & staff do not sync with student XP endpoints
  if (!isStudentUser()) {
    return getXpSummary()
  }

  if (studentId) {
    setActiveStudentId(studentId)
  }

  isSyncInProgress = true
  try {
    let localLedger = loadXpLedger()

    // Step 1: Query server for cloud backup
    let remoteLedger: Partial<XpLedger> | null = null
    try {
      const getResp = await apiFetch("/student-xp", { method: "GET", cache: "no-store" })
      if (getResp.ok) {
        const body = await getResp.json().catch(() => ({}))
        if (body?.student?.student_id && !activeStudentId) {
          setActiveStudentId(body.student.student_id)
        }
        if (body?.ledger && Array.isArray(body.ledger.events)) {
          remoteLedger = body.ledger as Partial<XpLedger>
        }
      }
    } catch {
      // Offline / guest mode - continue gracefully with local ledger
    }

    // Step 2: If remote ledger exists, merge remote events into local
    let hasRemoteNewEvents = false
    if (remoteLedger && Array.isArray(remoteLedger.events)) {
      const existingIds = new Set(localLedger.events.map((e) => e.id))
      for (const remoteEvt of remoteLedger.events) {
        if (remoteEvt?.id && !existingIds.has(remoteEvt.id)) {
          // Re-sign with current device salt for tamper resilience
          const evtWithoutSig = {
            id: remoteEvt.id,
            category: remoteEvt.category || "tinkering",
            title: remoteEvt.title || "Restored Cloud Event",
            xp: Number(remoteEvt.xp || 0),
            timestamp: Number(remoteEvt.timestamp || Date.now()),
            metadata: remoteEvt.metadata,
          }
          const signature = generateSignature(evtWithoutSig, localLedger.salt)
          localLedger.events.push({
            ...evtWithoutSig,
            signature,
          })
          hasRemoteNewEvents = true
        }
      }

      if (remoteLedger.streakDays && remoteLedger.streakDays > localLedger.streakDays) {
        localLedger.streakDays = remoteLedger.streakDays
        if (remoteLedger.lastActiveDate) {
          localLedger.lastActiveDate = remoteLedger.lastActiveDate
        }
      }
    }

    // If local was empty (cleared) or remote had more events, save and re-hydrate without triggering sync loop
    if (hasRemoteNewEvents || (localLedger.events.length === 0 && remoteLedger?.events?.length)) {
      saveXpLedger(localLedger, activeStudentId, { skipSync: true })
    }

    // Step 3: If local has unsynced events or newCreation, push to server
    const remoteEventCount = remoteLedger?.events?.length || 0
    const needsPush = localLedger.events.length > remoteEventCount || Boolean(options?.newCreation)

    if (needsPush) {
      try {
        const pushPayload = {
          events: localLedger.events,
          streakDays: localLedger.streakDays,
          lastActiveDate: localLedger.lastActiveDate,
          salt: localLedger.salt,
          newCreation: options?.newCreation,
        }
        const postResp = await apiFetch("/student-xp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pushPayload),
        })
        if (postResp.ok) {
          lastSyncTimestamp = Date.now()
          window.dispatchEvent(new CustomEvent(XP_SYNC_EVENT, { detail: { syncedAt: lastSyncTimestamp } }))
        }
      } catch {
        // Postponed to next online sync
      }
    } else if (remoteLedger) {
      lastSyncTimestamp = Date.now()
      window.dispatchEvent(new CustomEvent(XP_SYNC_EVENT, { detail: { syncedAt: lastSyncTimestamp } }))
    }

    return getXpSummary(localLedger)
  } catch {
    return getXpSummary()
  } finally {
    isSyncInProgress = false
    if (hasPendingSyncRequest) {
      hasPendingSyncRequest = false
      scheduleXpSync()
    }
  }
}

export interface SchoolLeaderboardEntry {
  school_id: string
  school_code: string
  school_name: string
  total_xp: number
  active_students: number
  creations_count: number
  rank: number
}

export interface ClassLeaderboardStudent {
  student_id: string
  name: string
  roll_number: number | null
  total_xp: number
  rank: number
  is_current_user?: boolean
}

export interface LeaderboardResult {
  leaderboard: SchoolLeaderboardEntry[]
  total_schools: number
  student_class_rank: number | null
  student_class_total: number
  student_class_name?: string | null
  class_leaderboard?: ClassLeaderboardStudent[]
}

/**
 * Fetch live school-wise ranking and class rank from backend
 */
export async function fetchSchoolLeaderboard(): Promise<LeaderboardResult | null> {
  if (typeof window === "undefined") return null
  try {
    const resp = await apiFetch("/school-leaderboard", { method: "GET", cache: "no-store" })
    if (!resp.ok) return null
    return (await resp.json().catch(() => null)) as LeaderboardResult | null
  } catch {
    return null
  }
}

export interface DedicatedClassRankingStudent {
  student_id: string
  name: string
  roll_number: number | null
  rank: number
  rank_display?: string
  score: number
  practical?: number
  quiz?: number
  attendance?: number
  trainer_review?: number
  is_current_user?: boolean
}

export interface DedicatedClassRankingResult {
  class_name: string
  school_name: string
  school_code?: string
  total_students: number
  student_rank: number | null
  student_score: number | null
  ranking: DedicatedClassRankingStudent[]
}

/**
 * Fetch live class-wise leaderboard & peer standings from backend
 */
export async function fetchClassLeaderboard(): Promise<DedicatedClassRankingResult | null> {
  if (typeof window === "undefined") return null
  try {
    const resp = await apiFetch("/class-ranking", { method: "GET", cache: "no-store" })
    if (!resp.ok) return null
    const data = await resp.json().catch(() => null)
    if (!data) return null
    const currentId = data.student?.student_id
    const rankingList: DedicatedClassRankingStudent[] = Array.isArray(data.ranking)
      ? data.ranking.map((r: any) => ({
          ...r,
          is_current_user: Boolean(currentId && r.student_id === currentId),
        }))
      : []

    return {
      class_name: data.class?.name || (data.class ? `Class ${data.class.grade || ""}-${data.class.section || ""}`.trim() : "My Class"),
      school_name: data.class?.school_name || "",
      school_code: data.class?.school_code || "",
      total_students: data.total_students || rankingList.length,
      student_rank: data.student?.rank ?? null,
      student_score: data.student?.score ?? null,
      ranking: rankingList,
    }
  } catch {
    return null
  }
}
