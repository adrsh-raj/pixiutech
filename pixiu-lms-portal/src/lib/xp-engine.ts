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
 * - Per-student scoped ledgers + guest offline persistence
 * - Idempotent event keys to prevent spamming/re-granting
 * - Daily XP caps (500 XP / day) against auto-clickers/bots
 * - Multi-surface synchronization between Circuit Lab and Student Portal
 * - Live School-wise & Class-wise Leaderboard aggregation
 */

import type { CircuitState } from "./circuit-types"
import { apiFetch } from "@/context/AuthContext"

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
  { level: 1, title: "Circuit Novice", icon: "🔌", badge: "Novice", minXp: 0, maxXp: 200, color: "text-emerald-400", bgGlow: "from-emerald-500/20 to-transparent" },
  { level: 2, title: "Logic Wireman", icon: "⚙️", badge: "Wireman", minXp: 201, maxXp: 600, color: "text-cyan-400", bgGlow: "from-cyan-500/20 to-transparent" },
  { level: 3, title: "Sensor Explorer", icon: "📡", badge: "Explorer", minXp: 601, maxXp: 1200, color: "text-amber-400", bgGlow: "from-amber-500/20 to-transparent" },
  { level: 4, title: "Robotics Builder", icon: "🤖", badge: "Builder", minXp: 1201, maxXp: 2200, color: "text-blue-400", bgGlow: "from-blue-500/20 to-transparent" },
  { level: 5, title: "AI Hardware Architect", icon: "🧠", badge: "Architect", minXp: 2201, maxXp: 3500, color: "text-purple-400", bgGlow: "from-purple-500/20 to-transparent" },
  { level: 6, title: "Grandmaster Innovator", icon: "🏆", badge: "Grandmaster", minXp: 3501, maxXp: 100000, color: "text-yellow-400", bgGlow: "from-yellow-500/20 to-transparent" },
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
}

const SECRET_SALT = "pixiu_cyberlab_anti_tamper_salt_2026"
let activeStudentId: string | null = null
let syncTimeout: number | null = null
let lastSyncTimestamp: number = 0
let isSyncInProgress = false

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

function getTodayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
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

export function setActiveStudentId(studentId: string | null) {
  activeStudentId = studentId ? String(studentId).trim().toUpperCase() : null
  if (typeof window !== "undefined" && activeStudentId) {
    try {
      // If student key doesn't exist yet, but general key does, migrate general key
      const studentKey = `${XP_STORAGE_KEY}_${activeStudentId}`
      const studentData = window.localStorage.getItem(studentKey)
      const genericData = window.localStorage.getItem(XP_STORAGE_KEY)
      if (!studentData && genericData) {
        window.localStorage.setItem(studentKey, genericData)
      }
    } catch {
      // Storage unavailable
    }
  }
}

export function getActiveStudentId(): string | null {
  return activeStudentId
}

export function getXpStorageKey(studentId?: string | null): string {
  const sid = studentId ? String(studentId).trim().toUpperCase() : activeStudentId
  return sid ? `${XP_STORAGE_KEY}_${sid}` : XP_STORAGE_KEY
}

export function loadXpLedger(studentId?: string | null): XpLedger {
  const salt = getDeviceSalt()
  const defaultLedger: XpLedger = {
    version: 2,
    events: [],
    lastActiveDate: getTodayKey(),
    streakDays: 1,
    salt,
  }

  if (typeof window === "undefined") return defaultLedger

  try {
    const key = getXpStorageKey(studentId)
    let raw = window.localStorage.getItem(key)
    if (!raw && key !== XP_STORAGE_KEY) {
      // Check generic fallback
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
      streakDays: typeof parsed.streakDays === "number" ? parsed.streakDays : 1,
      salt: parsed.salt || salt,
    }
  } catch {
    return defaultLedger
  }
}

export function saveXpLedger(ledger: XpLedger, studentId?: string | null) {
  if (typeof window === "undefined") return
  try {
    const key = getXpStorageKey(studentId)
    const jsonStr = JSON.stringify(ledger)
    window.localStorage.setItem(key, jsonStr)
    if (key !== XP_STORAGE_KEY) {
      window.localStorage.setItem(XP_STORAGE_KEY, jsonStr)
    }
    window.dispatchEvent(new CustomEvent(XP_UPDATE_EVENT, { detail: getXpSummary(ledger) }))
    scheduleXpSync()
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
  const nextLevel = XP_LEVELS.find((l) => l.level === levelInfo.level + 1)
  const currentLevelMin = levelInfo.minXp
  const nextLevelMin = nextLevel ? nextLevel.minXp : levelInfo.maxXp

  const levelXpSpan = Math.max(1, nextLevelMin - currentLevelMin)
  const progressInLevel = Math.max(0, totalXp - currentLevelMin)
  const progressPercent = nextLevel ? Math.min(100, Math.round((progressInLevel / levelXpSpan) * 100)) : 100

  // Badges collection
  const badges: string[] = []
  if (totalMissions >= 1) badges.push("🔌 First Blink")
  if (totalMissions >= 5) badges.push("⚙️ Logic Master")
  if (totalMissions >= 10) badges.push("📡 Sensor Pro")
  if (totalMissions >= 18) badges.push("🚗 AI Pioneer")
  if (totalCreations >= 1) badges.push("🎨 Creator")
  if (totalCreations >= 5) badges.push("🚀 Master Architect")
  if (currentLedger.streakDays >= 3) badges.push("🔥 3-Day Streak")
  if (currentLedger.streakDays >= 7) badges.push("⚡ 7-Day Champion")

  return {
    totalXp,
    level: levelInfo.level,
    levelInfo,
    currentLevelXp: progressInLevel,
    nextLevelXp: nextLevelMin,
    progressPercent,
    todayXp,
    dailyCapRemaining: Math.max(0, DAILY_XP_CAP - todayXp),
    streakDays: currentLedger.streakDays,
    totalMissionsCompleted: totalMissions,
    totalCreationsSaved: totalCreations,
    events: [...currentLedger.events].reverse(),
    badges,
    cloudSynced: lastSyncTimestamp > 0,
    lastSyncedAt: lastSyncTimestamp,
  }
}

/**
 * Grants XP for an event if not already rewarded and not exceeding daily cap
 */
export function awardXp(
  id: string,
  category: XpCategory,
  title: string,
  baseXp: number,
  metadata?: Record<string, unknown>,
): boolean {
  if (typeof window === "undefined") return false
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

  // Update streak if needed
  if (ledger.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
    if (ledger.lastActiveDate === yesterday) {
      ledger.streakDays = (ledger.streakDays || 1) + 1
    } else {
      ledger.streakDays = 1
    }
    ledger.lastActiveDate = today
  }

  ledger.events.push(newEvent)
  saveXpLedger(ledger)
  return true
}

/**
 * Award XP for completing an interactive curriculum mission
 */
export function awardMissionXp(lessonId: string, difficulty: "Beginner" | "Intermediate" | "Advanced", title: string): boolean {
  const points = difficulty === "Beginner" ? 50 : difficulty === "Intermediate" ? 100 : 200
  return awardXp(`mission:${lessonId}`, "mission", `Completed ${title}`, points, { lessonId, difficulty })
}

/**
 * Award XP for saving a verified custom circuit
 */
export function awardCreationXp(circuit: CircuitState, blocklyXml: string, projectName: string): boolean {
  const unoCount = circuit.parts.filter((p) => p.type === "arduino-uno").length
  const totalParts = circuit.parts.length
  const totalWires = circuit.wires.length

  if (unoCount < 1 || totalParts < 3 || totalWires < 2) {
    return false
  }

  const partTypes = circuit.parts.map((p) => p.type).sort().join(",")
  const wireNet = circuit.wires.map((w) => `${w.from.partId}:${w.from.pinId}->${w.to.partId}:${w.to.pinId}`).sort().join(";")
  const circuitHash = fnv1a(`${partTypes}|${wireNet}`)

  let basePoints = 75
  const hasAi = blocklyXml.includes('type="ai_') || circuit.parts.some((p) => p.type === "servo" && p.props?.arm === "barrier")
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
    void syncXpWithServer(null, {
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
  const today = getTodayKey()
  const intervalIndex = Math.floor(Date.now() / (1000 * 60 * 5)) // 5 minute slot
  return awardXp(`tinker:${today}:${intervalIndex}`, "tinkering", "Active Circuit Simulation & Testing", 10)
}

/**
 * Schedule a debounced cloud sync (1200ms)
 */
export function scheduleXpSync() {
  if (typeof window === "undefined") return
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
 */
export async function syncXpWithServer(
  studentId?: string | null,
  options?: {
    forceFetch?: boolean
    newCreation?: { name: string; summary: string }
  },
): Promise<XpSummary | null> {
  if (typeof window === "undefined" || isSyncInProgress) return null

  if (studentId) {
    setActiveStudentId(studentId)
  }

  isSyncInProgress = true
  try {
    let localLedger = loadXpLedger()
    const shouldFetch = options?.forceFetch || localLedger.events.length === 0

    // Step 1: Query server for cloud backup
    let remoteLedger: Partial<XpLedger> | null = null
    try {
      const getResp = await apiFetch("/student-xp", { method: "GET", cache: "no-store" })
      if (getResp.ok) {
        const body = await getResp.json().catch(() => ({}))
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
      }
    }

    // If local was empty (cleared) or remote had more events, save and re-hydrate immediately
    if (hasRemoteNewEvents || (localLedger.events.length === 0 && remoteLedger?.events?.length)) {
      saveXpLedger(localLedger)
    }

    // Step 3: If local has unsynced events or newCreation, push to server
    const remoteEventCount = remoteLedger?.events?.length || 0
    const needsPush = localLedger.events.length > remoteEventCount || Boolean(options?.newCreation)

    if (needsPush) {
      try {
        const pushPayload = {
          events: localLedger.events,
          streakDays: localLedger.streakDays,
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

export interface LeaderboardResult {
  leaderboard: SchoolLeaderboardEntry[]
  total_schools: number
  student_class_rank: number | null
  student_class_total: number
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
