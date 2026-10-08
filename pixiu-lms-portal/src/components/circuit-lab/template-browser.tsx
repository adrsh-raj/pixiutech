import React, { useMemo, useState } from "react"
import { X, Sparkles, Layers, Cpu, ArrowRight } from "lucide-react"
import { TEMPLATES, type ProjectTemplate } from "@/lib/templates"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ProjectTemplate) => void
}

type DifficultyFilter = "all" | "Beginner" | "Intermediate" | "Advanced"
type BoardFilter = "all" | "arduino-uno" | "esp32-devkit" | "rpi-pico" | "microbit-v2"

const BOARD_LABELS: Record<string, { label: string; color: string }> = {
  "arduino-uno": { label: "Arduino Uno", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  "esp32-devkit": { label: "ESP32 DevKit", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  "rpi-pico": { label: "Raspberry Pi Pico", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  "microbit-v2": { label: "micro:bit v2", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
}

const getTemplateBoard = (tmpl: ProjectTemplate): string => {
  const p = tmpl.circuit.parts.find((part) =>
    ["arduino-uno", "esp32-devkit", "rpi-pico", "microbit-v2"].includes(part.type),
  )
  return p?.type ?? "arduino-uno"
}

export const TemplateBrowser: React.FC<Props> = ({ isOpen, onClose, onSelectTemplate }) => {
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all")
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all")

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((template) => {
      const matchesDifficulty = difficultyFilter === "all" || template.difficulty === difficultyFilter
      const board = getTemplateBoard(template)
      const matchesBoard = boardFilter === "all" || board === boardFilter
      return matchesDifficulty && matchesBoard
    })
  }, [difficultyFilter, boardFilter])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Starter Project Templates</h2>
              <p className="text-xs text-slate-400">Choose a curriculum project to load components and code instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Controls: Difficulty & Controller only */}
        <div className="border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Level / Difficulty filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Level:</span>
              {[
                { id: "all", label: "All Levels" },
                { id: "Beginner", label: "Beginner" },
                { id: "Intermediate", label: "Intermediate" },
                { id: "Advanced", label: "Advanced" },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  onClick={() => setDifficultyFilter(lvl.id as DifficultyFilter)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                    difficultyFilter === lvl.id
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                      : "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            {/* Controller filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Controller:</span>
              {[
                { id: "all", label: "All Boards" },
                { id: "arduino-uno", label: "Uno" },
                { id: "esp32-devkit", label: "ESP32" },
                { id: "rpi-pico", label: "Pico" },
                { id: "microbit-v2", label: "micro:bit" },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBoardFilter(b.id as BoardFilter)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                    boardFilter === b.id
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                      : "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <span className="text-[11px] font-mono text-slate-400 ml-auto font-medium">
            {filteredTemplates.length} templates
          </span>
        </div>

        {/* Templates Grid: Clean, modern cards without wall of text */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
          {filteredTemplates.map((tmpl) => {
            const boardKey = getTemplateBoard(tmpl)
            const boardMeta = BOARD_LABELS[boardKey] ?? { label: boardKey, color: "bg-slate-800 text-slate-300 border-slate-700" }
            return (
              <div
                key={tmpl.id}
                onClick={() => {
                  onClose()
                  onSelectTemplate(tmpl)
                }}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all duration-200 hover:border-blue-500/60 hover:bg-slate-850 hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer"
              >
                <div>
                  {/* Badges: Difficulty, Controller, Parts */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          tmpl.difficulty === "Beginner"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : tmpl.difficulty === "Intermediate"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                        }`}
                      >
                        {tmpl.difficulty}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${boardMeta.color}`}>
                        <Cpu size={11} />
                        {boardMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <Layers size={12} className="text-slate-400" />
                      <span>{tmpl.circuit.parts.length} parts</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1.5">
                    {tmpl.title}
                  </h3>

                  {/* Clean 2-line description */}
                  <p className="text-xs text-slate-400 leading-relaxed font-normal line-clamp-2 mb-3">
                    {tmpl.description}
                  </p>
                </div>

                {/* Footer with tags and Load action */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 mt-auto">
                  <div className="flex flex-wrap gap-1">
                    {tmpl.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {tmpl.tags.length > 3 && (
                      <span className="rounded bg-slate-800/50 px-1 py-0.5 text-[9px] font-mono text-slate-500">
                        +{tmpl.tags.length - 3}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all shrink-0">
                    <span>Load Project</span>
                    <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
