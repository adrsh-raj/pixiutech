import type { CircuitState } from './circuit-types'

export interface SavedCircuit {
  name: string
  state: CircuitState
  blocklyXml: string
  savedAt: string // ISO timestamp
  thumbnail?: string // optional base64 PNG
}

const STORAGE_PREFIX = 'pixiu-circuit-'
const MAX_CIRCUITS = 20

/**
 * Saves a circuit to localStorage.
 */
export function saveCircuit(name: string, state: CircuitState, blocklyXml: string): void {
  const circuits = listSavedCircuits()
  const existingIndex = circuits.findIndex(c => c.name === name)
  
  if (existingIndex === -1 && circuits.length >= MAX_CIRCUITS) {
    console.warn(`Maximum of ${MAX_CIRCUITS} saved circuits exceeded. Oldest might be overwritten soon if not managed.`)
  }

  const saved: SavedCircuit = {
    name,
    state,
    blocklyXml,
    savedAt: new Date().toISOString()
  }

  try {
    localStorage.setItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(saved))
  } catch (err) {
    console.error('Failed to save circuit to localStorage', err)
  }
}

/**
 * Loads a circuit from localStorage.
 */
export function loadCircuit(name: string): SavedCircuit | null {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${name}`)
    if (!data) return null
    return JSON.parse(data) as SavedCircuit
  } catch (err) {
    console.error(`Failed to load circuit ${name}`, err)
    return null
  }
}

/**
 * Lists all saved circuits in localStorage.
 */
export function listSavedCircuits(): SavedCircuit[] {
  const circuits: SavedCircuit[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      try {
        const data = localStorage.getItem(key)
        if (data) {
          circuits.push(JSON.parse(data) as SavedCircuit)
        }
      } catch (err) {
        console.error('Corrupt circuit data in localStorage for key', key, err)
      }
    }
  }
  return circuits.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
}

/**
 * Deletes a saved circuit from localStorage.
 */
export function deleteSavedCircuit(name: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${name}`)
}

/**
 * Exports a circuit as a downloadable JSON file.
 */
export function exportAsJSON(name: string, state: CircuitState, blocklyXml: string): void {
  const saved: SavedCircuit = {
    name,
    state,
    blocklyXml,
    savedAt: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/\s+/g, '_')}.circuit.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Imports a circuit from a JSON file.
 */
export function importFromJSON(file: File): Promise<SavedCircuit> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const parsed = JSON.parse(text)
        
        if (!parsed || !parsed.name || !parsed.state || typeof parsed.blocklyXml !== 'string') {
          throw new Error('Invalid circuit file format')
        }
        
        resolve(parsed as SavedCircuit)
      } catch (err) {
        reject(new Error('Failed to parse circuit file: ' + (err instanceof Error ? err.message : String(err))))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
