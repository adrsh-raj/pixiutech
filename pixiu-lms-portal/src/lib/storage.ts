import type { CircuitState, PartType, PinRef } from "./circuit-types"
import { CATALOG } from "./components-catalog"
import { decodePixiuProtocol, encodePixiuProtocol } from "./pixiu-file-protocol"

export const PIXIU_FILE_FORMAT = "pixiu-circuit"
export const PIXIU_FILE_VERSION = 2

export interface SavedCircuit {
  format: typeof PIXIU_FILE_FORMAT
  version: typeof PIXIU_FILE_VERSION
  name: string
  state: CircuitState
  blocklyXml: string
  savedAt: string
  createdAt: string
}

interface StoredCircuit extends SavedCircuit {
  id: string
  isCurrent?: boolean
}

const DB_NAME = "pixiu-circuit-studio"
const DB_VERSION = 1
const STORE_NAME = "projects"
const CURRENT_ID = "__pixiu_current__"
const IDB_PREFIX = "pixiu-circuit-v2-"
const LEGACY_PREFIX = "pixiu-circuit-"
const MAX_PROJECTS = 100
const MAX_PARTS = 250
const MAX_WIRES = 600
const MAX_BLOCKLY_XML_BYTES = 1024 * 1024

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined"
}

function normalizeProjectName(input: string): string {
  const cleaned = String(input || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)

  return cleaned || "Untitled Circuit"
}

function projectId(name: string): string {
  return normalizeProjectName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "untitled-circuit"
}

function getByteLength(value: string): number {
  try {
    return new TextEncoder().encode(value).length
  } catch {
    return value.length
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isPinRef(value: unknown): value is PinRef {
  return (
    isRecord(value) &&
    typeof value.partId === "string" &&
    value.partId.length > 0 &&
    value.partId.length <= 120 &&
    typeof value.pinId === "string" &&
    value.pinId.length > 0 &&
    value.pinId.length <= 80
  )
}

export function validateCircuitState(input: unknown): input is CircuitState {
  if (!isRecord(input) || !Array.isArray(input.parts) || !Array.isArray(input.wires)) return false
  if (input.parts.length > MAX_PARTS || input.wires.length > MAX_WIRES) return false

  const partIds = new Set<string>()

  for (const rawPart of input.parts) {
    if (!isRecord(rawPart)) return false

    const id = rawPart.id
    const type = rawPart.type
    if (typeof id !== "string" || id.length < 1 || id.length > 120 || partIds.has(id)) return false
    if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(CATALOG, type)) return false
    if (!isFiniteNumber(rawPart.x) || !isFiniteNumber(rawPart.y) || !isFiniteNumber(rawPart.rotation)) return false
    if (!isRecord(rawPart.props)) return false

    const def = CATALOG[type as PartType]
    const pins = new Set(def.pins.map((pin) => pin.id))

    for (const key of Object.keys(rawPart.props)) {
      const value = rawPart.props[key]
      if (typeof value !== "string" && !isFiniteNumber(value)) return false
      if (key.length > 80) return false
    }

    if (pins.size === 0) return false
    partIds.add(id)
  }

  const wireIds = new Set<string>()
  for (const rawWire of input.wires) {
    if (!isRecord(rawWire)) return false
    if (typeof rawWire.id !== "string" || rawWire.id.length < 1 || rawWire.id.length > 120 || wireIds.has(rawWire.id)) return false
    if (!isPinRef(rawWire.from) || !isPinRef(rawWire.to)) return false
    if (!partIds.has(rawWire.from.partId) || !partIds.has(rawWire.to.partId)) return false
    if (typeof rawWire.color !== "string" || rawWire.color.length > 40) return false
    wireIds.add(rawWire.id)
  }

  return true
}

function normalizeSavedCircuit(input: unknown): SavedCircuit {
  if (!isRecord(input)) throw new Error("Circuit file is not a valid object")

  if (input.format !== undefined && input.format !== PIXIU_FILE_FORMAT && input.format !== "pixiu-circuit") {
    throw new Error("This file is not a Pixiu circuit project")
  }

  const rawState = input.state
  const rawXml = input.blocklyXml
  if (!validateCircuitState(rawState)) {
    throw new Error("Circuit file contains invalid or unsupported component data")
  }
  if (typeof rawXml !== "string" || getByteLength(rawXml) > MAX_BLOCKLY_XML_BYTES) {
    throw new Error("Circuit file contains invalid Blockly data")
  }

  const name = normalizeProjectName(typeof input.name === "string" ? input.name : "Untitled Circuit")
  const savedAt = typeof input.savedAt === "string" && !Number.isNaN(Date.parse(input.savedAt))
    ? input.savedAt
    : new Date().toISOString()
  const createdAt = typeof input.createdAt === "string" && !Number.isNaN(Date.parse(input.createdAt))
    ? input.createdAt
    : savedAt

  return {
    format: PIXIU_FILE_FORMAT,
    version: PIXIU_FILE_VERSION,
    name,
    state: rawState,
    blocklyXml: rawXml,
    savedAt,
    createdAt,
  }
}

function toStored(circuit: SavedCircuit, id: string, isCurrent = false): StoredCircuit {
  return { ...circuit, id, isCurrent }
}

function toSaved(input: StoredCircuit): SavedCircuit {
  return {
    format: PIXIU_FILE_FORMAT,
    version: PIXIU_FILE_VERSION,
    name: normalizeProjectName(input.name),
    state: input.state,
    blocklyXml: input.blocklyXml,
    savedAt: input.savedAt,
    createdAt: input.createdAt,
  }
}

function isIndexedDbAvailable(): boolean {
  return isBrowser() && "indexedDB" in window
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is unavailable"))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("savedAt", "savedAt", { unique: false })
        store.createIndex("name", "name", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open project storage"))
  })
}

function requestPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

async function withIdb<T>(work: (db: IDBDatabase) => Promise<T>): Promise<T | null> {
  try {
    const db = await openDatabase()
    try {
      return await work(db)
    } finally {
      db.close()
    }
  } catch (error) {
    console.warn("Pixiu browser database unavailable; using local fallback.", error)
    return null
  }
}

function writeLocal(key: string, circuit: SavedCircuit): void {
  if (!isBrowser()) return
  localStorage.setItem(key, JSON.stringify(circuit))
}

function readLocal(key: string): SavedCircuit | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalizeSavedCircuit(JSON.parse(raw)) : null
  } catch (error) {
    console.warn("Ignoring corrupt local Pixiu project:", key, error)
    return null
  }
}

function removeLocal(key: string): void {
  if (!isBrowser()) return
  localStorage.removeItem(key)
}

async function putCircuit(circuit: SavedCircuit): Promise<SavedCircuit> {
  const current = toStored(circuit, CURRENT_ID, true)
  const named = toStored(circuit, projectId(circuit.name), false)

  const ok = await withIdb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      const store = tx.objectStore(STORE_NAME)
      store.put(named)
      store.put(current)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save project"))
      tx.onabort = () => reject(tx.error ?? new Error("Project save aborted"))
    })
    return true
  })

  if (ok !== null) {
    removeLocal(IDB_PREFIX + projectId(circuit.name))
    removeLocal(LEGACY_PREFIX + circuit.name)
    removeLocal(LEGACY_PREFIX + "current")
    return circuit
  }

  writeLocal(IDB_PREFIX + projectId(circuit.name), circuit)
  writeLocal(LEGACY_PREFIX + circuit.name, circuit)
  writeLocal(LEGACY_PREFIX + "current", circuit)
  return circuit
}

async function migrateLegacyCurrent(): Promise<SavedCircuit | null> {
  const current = readLocal(LEGACY_PREFIX + "current")
  const legacyDefault = current ?? readLocal(LEGACY_PREFIX + "default")
  if (!legacyDefault) return null

  const migrated = legacyDefault.name === "default"
    ? { ...legacyDefault, name: "Untitled Circuit" }
    : legacyDefault

  try {
    return await putCircuit(migrated)
  } catch {
    return migrated
  }
}

function uniqueByProjectId(circuits: SavedCircuit[]): SavedCircuit[] {
  const map = new Map<string, SavedCircuit>()
  for (const circuit of circuits) {
    const key = projectId(circuit.name)
    const existing = map.get(key)
    if (!existing || Date.parse(circuit.savedAt) > Date.parse(existing.savedAt)) {
      map.set(key, circuit)
    }
  }
  return [...map.values()].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))
}

export async function saveCircuit(name: string, state: CircuitState, blocklyXml: string): Promise<SavedCircuit> {
  if (!validateCircuitState(state)) throw new Error("Cannot save an invalid circuit")
  if (typeof blocklyXml !== "string" || getByteLength(blocklyXml) > MAX_BLOCKLY_XML_BYTES) {
    throw new Error("Blockly data is too large to save")
  }

  const normalizedName = normalizeProjectName(name)
  const now = new Date().toISOString()
  const previous = await loadCircuit(normalizedName)
  const circuit: SavedCircuit = {
    format: PIXIU_FILE_FORMAT,
    version: PIXIU_FILE_VERSION,
    name: normalizedName,
    state,
    blocklyXml,
    savedAt: now,
    createdAt: previous?.createdAt ?? now,
  }

  return putCircuit(circuit)
}

export async function loadCircuit(name: string): Promise<SavedCircuit | null> {
  const key = projectId(name)

  const idbResult = await withIdb(async (db) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).get(key)
    const raw = await requestPromise<StoredCircuit | undefined>(request)
    return raw ? toSaved(raw) : null
  })

  if (idbResult !== null) return idbResult

  return readLocal(IDB_PREFIX + key) ?? readLocal(LEGACY_PREFIX + name)
}

export async function saveCurrentCircuit(circuit: SavedCircuit): Promise<void> {
  const normalized = normalizeSavedCircuit(circuit)
  const current = toStored(normalized, CURRENT_ID, true)

  const ok = await withIdb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).put(current)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to update current project"))
      tx.onabort = () => reject(tx.error ?? new Error("Current project update aborted"))
    })
    return true
  })

  if (ok !== null) {
    removeLocal(LEGACY_PREFIX + "current")
    return
  }

  writeLocal(IDB_PREFIX + "current", normalized)
  writeLocal(LEGACY_PREFIX + "current", normalized)
}

export async function clearCurrentCircuit(): Promise<void> {
  await withIdb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(CURRENT_ID)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to clear current project"))
      tx.onabort = () => reject(tx.error ?? new Error("Current project clear aborted"))
    })
    return true
  })

  removeLocal(IDB_PREFIX + "current")
  removeLocal(LEGACY_PREFIX + "current")
}

export async function loadCurrentCircuit(): Promise<SavedCircuit | null> {
  const idbResult = await withIdb(async (db) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).get(CURRENT_ID)
    const raw = await requestPromise<StoredCircuit | undefined>(request)
    return raw ? toSaved(raw) : null
  })

  if (idbResult !== null && idbResult) return idbResult
  return (idbResult === null ? readLocal(IDB_PREFIX + "current") : null) ?? migrateLegacyCurrent()
}

export async function listSavedCircuits(): Promise<SavedCircuit[]> {
  const idbResult = await withIdb(async (db) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).getAll()
    const raw = await requestPromise<StoredCircuit[]>(request)
    return raw.filter((item) => item.id !== CURRENT_ID).map(toSaved)
  })

  const localCandidates: SavedCircuit[] = []
  if (isBrowser()) {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || (!(key.startsWith(LEGACY_PREFIX)) && !(key.startsWith(IDB_PREFIX)))) continue
      if (key === LEGACY_PREFIX + "current" || key === LEGACY_PREFIX + "default") continue
      const saved = readLocal(key)
      if (saved) localCandidates.push(saved)
    }
  }

  return uniqueByProjectId([...(idbResult ?? []), ...localCandidates]).slice(0, MAX_PROJECTS)
}

export async function deleteSavedCircuit(name: string): Promise<void> {
  const key = projectId(name)

  await withIdb(async (db) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite")
      tx.objectStore(STORE_NAME).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error("Failed to delete project"))
      tx.onabort = () => reject(tx.error ?? new Error("Project delete aborted"))
    })
    return true
  })

  removeLocal(IDB_PREFIX + key)
  removeLocal(LEGACY_PREFIX + name)

  const current = await loadCurrentCircuit()
  if (current && projectId(current.name) === key) {
    await withIdb(async (db) => {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite")
        tx.objectStore(STORE_NAME).delete(CURRENT_ID)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error("Failed to clear current project"))
      })
      return true
    })
    removeLocal(LEGACY_PREFIX + "current")
  }
}

export async function exportAsJSON(
  name: string,
  state: CircuitState,
  blocklyXml: string,
  password?: string,
): Promise<void> {
  if (!isBrowser()) throw new Error("Export is only available in the browser")
  if (!validateCircuitState(state)) throw new Error("Cannot export an invalid circuit")

  const normalizedName = normalizeProjectName(name)
  const now = new Date().toISOString()
  const circuit: SavedCircuit = {
    format: PIXIU_FILE_FORMAT,
    version: PIXIU_FILE_VERSION,
    name: normalizedName,
    state,
    blocklyXml,
    savedAt: now,
    createdAt: now,
  }

  const blob = await encodePixiuProtocol(circuit, password)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = normalizedName.replace(/\s+/g, "_") + ".pixiu"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function importFromJSON(file: File, password?: string): Promise<SavedCircuit> {
  return new Promise((resolve, reject) => {
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith(".pixiu") && !lowerName.endsWith(".circuit.json")) {
      reject(new Error("Invalid file type. Please choose a .pixiu circuit file."))
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("This circuit file is larger than 3 MB and was rejected for safety."))
      return
    }

    file.arrayBuffer()
      .then(async (rawBytes) => {
        try {
          if (rawBytes.byteLength > 3 * 1024 * 1024) throw new Error("This circuit file is too large.")
          const parsed = await decodePixiuProtocol(rawBytes, password) as Record<string, unknown>
          resolve(normalizeSavedCircuit(parsed))
        } catch (error) {
          reject(new Error(error instanceof Error ? error.message : String(error)))
        }
      })
      .catch(() => reject(new Error("Failed to read circuit file")))
  })
}
