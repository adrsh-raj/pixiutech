import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Check,
  Clock3,
  Download,
  FolderOpen,
  FileUp,
  HardDrive,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react"
import {
  deleteSavedCircuit,
  exportAsJSON,
  listSavedCircuits,
  type SavedCircuit,
} from "@/lib/storage"

interface Props {
  isOpen: boolean
  currentProjectName: string
  lastSaved: string | null
  dirty: boolean
  storageReady: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
  onNew: () => void
  onImport: (file: File) => Promise<void>
  onLoad: (project: SavedCircuit) => Promise<void>
  onExportCurrent: () => void
}

function formatDate(value: string | null): string {
  if (!value) return "Not saved yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function projectStats(project: SavedCircuit): string {
  const parts = project.state.parts.length
  const wires = project.state.wires.length
  return parts + " component" + (parts === 1 ? "" : "s") + " · " + wires + " wire" + (wires === 1 ? "" : "s")
}

export function ProjectManager({
  isOpen,
  currentProjectName,
  lastSaved,
  dirty,
  storageReady,
  onClose,
  onSave,
  onNew,
  onImport,
  onLoad,
  onExportCurrent,
}: Props) {
  const [projects, setProjects] = useState<SavedCircuit[]>([])
  const [name, setName] = useState(currentProjectName)
  const [loading, setLoading] = useState(false)
  const [busyProject, setBusyProject] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const refreshProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await listSavedCircuits())
    } catch {
      setError("Could not read saved projects from this browser.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setName(currentProjectName)
    void refreshProjects()
  }, [isOpen, currentProjectName, refreshProjects])

  const currentStatus = useMemo(() => {
    if (!storageReady) return { label: "Starting storage…", tone: "text-slate-400" }
    if (dirty) return { label: "Unsaved changes", tone: "text-amber-300" }
    if (lastSaved) return { label: "Saved locally", tone: "text-emerald-300" }
    return { label: "Ready to save", tone: "text-slate-400" }
  }, [dirty, lastSaved, storageReady])

  const handleSave = async () => {
    const nextName = name.trim() || "Untitled Circuit"
    setBusyProject("__current__")
    setError(null)
    try {
      await onSave(nextName)
      await refreshProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this project.")
    } finally {
      setBusyProject(null)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusyProject("__import__")
    try {
      await onImport(file)
      await refreshProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import this file.")
    } finally {
      setBusyProject(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleLoad = async (project: SavedCircuit) => {
    if (dirty && !window.confirm("You have unsaved changes. Load this project and discard them?")) return
    setBusyProject(project.name)
    setError(null)
    try {
      await onLoad(project)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this project.")
    } finally {
      setBusyProject(null)
    }
  }

  const handleDelete = async (project: SavedCircuit) => {
    if (!window.confirm("Delete “" + project.name + "” from this browser? This cannot be undone.")) return
    setBusyProject(project.name)
    setError(null)
    try {
      await deleteSavedCircuit(project.name)
      if (project.name === currentProjectName) onNew()
      await refreshProjects()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this project.")
    } finally {
      setBusyProject(null)
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDraggingFile(false)
    await handleImport(event.dataTransfer.files?.[0])
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Project manager"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-blue-400/20 bg-[#0b1220] text-slate-100 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20">
              <FolderOpen size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold sm:text-base">Circuit Projects</h2>
              <p className="text-[11px] text-slate-400">Save, restore, import and carry your Pixiu circuits.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close project manager"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid max-h-[78vh] overflow-y-auto md:grid-cols-[minmax(280px,0.95fr)_minmax(340px,1.25fr)]">
          <section className="border-b border-slate-800 p-4 sm:p-5 md:border-b-0 md:border-r">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Current project</p>
                <span className={"text-[10px] font-semibold " + currentStatus.tone}>{currentStatus.label}</span>
              </div>

              <label className="mb-1 block text-[11px] font-semibold text-slate-400">Project name</label>
              <input
                value={name}
                maxLength={80}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSave()
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15"
                placeholder="My first Arduino project"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => void handleSave()}
                  disabled={busyProject !== null || !storageReady}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyProject === "__current__" ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
                <button
                  onClick={() => {
                    onNew()
                    setName("Untitled Circuit")
                    setError(null)
                  }}
                  disabled={busyProject !== null}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus size={14} />
                  New
                </button>
              </div>

              <button
                onClick={onExportCurrent}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-400/40 hover:text-blue-200"
              >
                <Download size={14} />
                Download current .pixiu
              </button>

              <div className="mt-3 flex items-center gap-2 border-t border-blue-500/10 pt-3 text-[10px] text-slate-500">
                <Clock3 size={12} />
                <span>Last saved: {formatDate(lastSaved)}</span>
              </div>
            </div>

            <div
              className={"mt-3 rounded-2xl border border-dashed p-4 text-center transition " + (
                isDraggingFile
                  ? "border-blue-400 bg-blue-500/10"
                  : "border-slate-700 bg-slate-950/35 hover:border-slate-600"
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDraggingFile(true)
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onDrop={(event) => void handleDrop(event)}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pixiu,.circuit.json,application/x-pixiu-circuit"
                onChange={(event) => void handleImport(event.target.files?.[0])}
                className="hidden"
              />
              <UploadCloud size={22} className="mx-auto mb-2 text-blue-300" />
              <p className="text-xs font-bold text-slate-200">Bring a circuit from another computer</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">Drop a .pixiu file here, or choose one from your device.</p>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busyProject !== null}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-blue-200 transition hover:bg-blue-500/15 disabled:opacity-50"
              >
                {busyProject === "__import__" ? <RefreshCw size={13} className="animate-spin" /> : <FileUp size={13} />}
                Import .pixiu
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[10px] leading-4 text-slate-500">
              <HardDrive size={13} className="mt-0.5 shrink-0 text-slate-400" />
              <span>Projects are stored locally in this browser. The .pixiu file is the portable backup and transfer format.</span>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] leading-4 text-red-200">
                {error}
              </div>
            )}
          </section>

          <section className="min-h-[360px] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Saved projects</p>
                <p className="text-[10px] text-slate-500">Your recent browser-local workspaces.</p>
              </div>
              <button
                onClick={() => void refreshProjects()}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="Refresh project list"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center text-xs text-slate-500">
                <RefreshCw size={16} className="mr-2 animate-spin" /> Reading local projects…
              </div>
            ) : projects.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/25 px-6 text-center">
                <FolderOpen size={30} className="mb-3 text-slate-600" />
                <p className="text-xs font-bold text-slate-300">No saved projects yet</p>
                <p className="mt-1 max-w-xs text-[10px] leading-4 text-slate-500">Save this project to create your first local workspace. You can always download a .pixiu copy.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {projects.map((project) => (
                  <div
                    key={project.name.toLowerCase()}
                    className="group rounded-2xl border border-slate-800 bg-slate-950/35 p-3 transition hover:border-blue-400/25 hover:bg-blue-500/[0.035]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-blue-300 ring-1 ring-slate-800">
                        <FolderOpen size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">{project.name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{projectStats(project)} · {formatDate(project.savedAt)}</p>
                      </div>
                      {project.name === currentProjectName && !dirty && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-300">
                          <Check size={10} /> Current
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5 pl-12">
                      <button
                        onClick={() => void handleLoad(project)}
                        disabled={busyProject !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/15 px-2.5 py-1.5 text-[10px] font-bold text-blue-200 transition hover:bg-blue-600/25 disabled:opacity-50"
                      >
                        {busyProject === project.name ? <RefreshCw size={12} className="animate-spin" /> : <FolderOpen size={12} />}
                        Open
                      </button>
                      <button
                        onClick={() => exportAsJSON(project.name, project.state, project.blocklyXml)}
                        disabled={busyProject !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Download size={12} /> .pixiu
                      </button>
                      <button
                        onClick={() => void handleDelete(project)}
                        disabled={busyProject !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {busyProject === project.name && project.name !== currentProjectName ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
          <span>Pixiu Circuit Studio · local-first project storage</span>
          <button onClick={onClose} className="font-semibold text-slate-300 transition hover:text-white">Done</button>
        </div>
      </div>
    </div>
  )
}
