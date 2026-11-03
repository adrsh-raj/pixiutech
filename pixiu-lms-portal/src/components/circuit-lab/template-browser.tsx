import React, { useEffect, useMemo, useState } from "react"
import { ArrowRight, Cpu, Layers, Search, X } from "lucide-react"
import { TEMPLATES, type ProjectTemplate } from "@/lib/templates"
import { BOARD_REGISTRY, type BoardId } from "@/lib/board-registry"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ProjectTemplate) => void
}

type DifficultyFilter = "all" | "Beginner" | "Intermediate" | "Advanced"
type BoardFilter = "all" | "arduino-uno" | "esp32-devkit" | "rpi-pico" | "microbit-v2"
type CategoryFilter = "all" | "AI & vision" | "Connected systems" | "Robotics" | "Sensors" | "Displays" | "Prototypes"

const BOARD_STYLES: Record<BoardId, string> = {
  "arduino-uno": "bg-blue-500/10 text-blue-300 border-blue-500/25",
  "esp32-devkit": "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  "rpi-pico": "bg-violet-500/10 text-violet-300 border-violet-500/25",
  "microbit-v2": "bg-amber-500/10 text-amber-300 border-amber-500/25",
}

const cleanTitle = (value: string) => {
  const withoutIcons = Array.from(value).filter((character) => {
    const point = character.codePointAt(0) || 0
    return !((point >= 0x1f300 && point <= 0x1faff) || (point >= 0x2600 && point <= 0x27bf) || point === 0xfe0f || point === 0x200d)
  }).join("")
  return withoutIcons.replace(/^\s*\d+\s*[.)-]\s*/, "").replace(/\s+/g, " ").trim()
}

const getTemplateBoard = (template: ProjectTemplate): string => {
  const part = template.circuit.parts.find((item) =>
    ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].includes(item.type),
  )
  return part?.type ?? "arduino-uno"
}

const getCategory = (template: ProjectTemplate): CategoryFilter => {
  const text = (cleanTitle(template.title) + " " + template.tags.join(" ") + " " + template.description).toLowerCase()
  if (/(ai|vision|camera|gesture|machine learning|image)/.test(text)) return "AI & vision"
  if (/(servo|robot|motor|radar|barrier|arm|rover)/.test(text)) return "Robotics"
  if (/(wifi|web server|iot|telemetry|wireless|smart home|cloud)/.test(text)) return "Connected systems"
  if (/(sensor|dht|ldr|ultrasonic|temperature|gas|weather|soil|light|distance|fire)/.test(text)) return "Sensors"
  if (/(display|oled|matrix|lcd|arcade|pixel|button|keypad|sound|audio|led)/.test(text)) return "Displays"
  return "Prototypes"
}

export const TemplateBrowser: React.FC<Props> = ({ isOpen, onClose, onSelectTemplate }) => {
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all")
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return TEMPLATES.filter((template) => {
      if (difficultyFilter !== "all" && template.difficulty !== difficultyFilter) return false
      const board = getTemplateBoard(template)
      if (boardFilter !== "all" && board !== boardFilter) return false
      if (categoryFilter !== "all" && getCategory(template) !== categoryFilter) return false
      if (!query) return true
      const haystack = [cleanTitle(template.title), template.description, template.tags.join(" "), BOARD_REGISTRY[board as BoardId]?.name ?? board, getCategory(template)].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [boardFilter, categoryFilter, difficultyFilter, search])

  if (!isOpen) return null

  const filters = [
    { id: "all", label: "All projects" },
    { id: "AI & vision", label: "AI & vision" },
    { id: "Connected systems", label: "Connected systems" },
    { id: "Robotics", label: "Robotics" },
    { id: "Sensors", label: "Sensors" },
    { id: "Displays", label: "Displays" },
    { id: "Prototypes", label: "Prototypes" },
  ]

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="template-browser-title" className="flex h-[min(90dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0d1523] text-white shadow-2xl shadow-black/60">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Virtual Lab / Project library</p>
            <h2 id="template-browser-title" className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Project templates</h2>
            <p className="mt-1 text-xs text-slate-400">Choose a starting point, inspect the parts, then adapt the circuit and code.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close project library" className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
            <X size={17} />
          </button>
        </header>

        <div className="space-y-4 border-b border-slate-800 bg-slate-950/35 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block min-w-0 flex-1">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <span className="sr-only">Search project templates</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search projects, components, or concepts" className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/10" />
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label="Filter by experience level">
              {(["all", "Beginner", "Intermediate", "Advanced"] as DifficultyFilter[]).map((level) => {
                const label = level === "all" ? "All levels" : level
                const selected = difficultyFilter === level
                return <button key={level} type="button" aria-pressed={selected} onClick={() => setDifficultyFilter(level)} className={"rounded-full border px-3 py-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " + (selected ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white")}>{label}</button>
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
            <div className="flex flex-wrap gap-1.5" aria-label="Filter by project category">
              {filters.map((filter) => {
                const selected = categoryFilter === filter.id
                return <button key={filter.id} type="button" aria-pressed={selected} onClick={() => setCategoryFilter(filter.id as CategoryFilter)} className={"rounded-md px-2.5 py-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 " + (selected ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200")}>{filter.label}</button>
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>{filteredTemplates.length} of {TEMPLATES.length} projects</span>
              <span className="hidden text-slate-700 sm:inline">|</span>
              <label className="flex items-center gap-1.5">
                <span className="sr-only">Filter by board</span>
                <select value={boardFilter} onChange={(event) => setBoardFilter(event.target.value as BoardFilter)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-300 focus:border-cyan-400/70 focus:outline-none">
                  <option value="all">All boards</option>
                  <option value="arduino-uno">Arduino Uno</option>
                  <option value="esp32-devkit">ESP32</option>
                  <option value="rpi-pico">Raspberry Pi Pico</option>
                  <option value="microbit-v2">BBC micro:bit</option>
                </select>
              </label>
              <button type="button" onClick={() => { setSearch(""); setCategoryFilter("all"); setDifficultyFilter("all"); setBoardFilter("all") }} className="text-cyan-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Clear filters</button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredTemplates.length === 0 ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-700 px-6 text-center">
              <div><p className="text-sm font-medium text-slate-200">No matching projects</p><p className="mt-1 text-xs text-slate-500">Clear a filter or try another search term.</p></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredTemplates.map((template) => {
                const boardKey = getTemplateBoard(template)
                const boardId = boardKey as BoardId
                const boardMeta = { label: BOARD_REGISTRY[boardId]?.name ?? boardKey, color: BOARD_STYLES[boardId] ?? "border-slate-700 bg-slate-900 text-slate-300" }
                const clean = cleanTitle(template.title)
                return (
                  <button key={template.id} type="button" onClick={() => { onClose(); onSelectTemplate({ ...template, title: clean }) }} aria-label={"Load project template: " + clean} className="group flex min-h-[190px] w-full flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left transition hover:border-cyan-400/35 hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                    <div className="w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={"rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide " + (template.difficulty === "Beginner" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : template.difficulty === "Intermediate" ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-violet-500/25 bg-violet-500/10 text-violet-300")}>{template.difficulty}</span>
                        <span className={"inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium " + boardMeta.color}><Cpu size={12} aria-hidden="true" />{boardMeta.label}</span>
                        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-slate-500"><Layers size={12} aria-hidden="true" />{template.circuit.parts.length} parts</span>
                      </div>
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{getCategory(template)}</p>
                      <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-100 group-hover:text-cyan-200 line-clamp-2">{clean}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{template.description}</p>
                    </div>
                    <div className="mt-4 flex w-full items-end justify-between gap-3 border-t border-slate-800 pt-3">
                      <div className="flex min-w-0 flex-wrap gap-1.5">
                        {template.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded bg-slate-800/70 px-1.5 py-1 text-[9px] text-slate-400">{tag}</span>)}
                        {template.tags.length > 3 && <span className="rounded bg-slate-800/50 px-1.5 py-1 text-[9px] text-slate-500">+{template.tags.length - 3}</span>}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-cyan-300">Open project <ArrowRight size={13} aria-hidden="true" /></span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
