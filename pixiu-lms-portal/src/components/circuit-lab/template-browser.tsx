import React, { useMemo, useState } from "react"
import { X, Sparkles, Layers, Check, Cpu } from "lucide-react"
import { TEMPLATES, type ProjectTemplate, type TemplateGrade } from "@/lib/templates"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ProjectTemplate) => void
}

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
  const [gradeFilter, setGradeFilter] = useState<"all" | TemplateGrade>("all")
  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all")

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((template) => {
      const matchesGrade = gradeFilter === "all" || template.gradeBand === gradeFilter
      const board = getTemplateBoard(template)
      const matchesBoard = boardFilter === "all" || board === boardFilter
      return matchesGrade && matchesBoard
    })
  }, [gradeFilter, boardFilter])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
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

        {/* Filter Controls */}
        <div className="border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-slate-950/40">
          {/* Grade filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Grade:</span>
            {(["all", 6, 7, 8] as const).map((grade) => (
              <button
                key={String(grade)}
                onClick={() => setGradeFilter(grade)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  gradeFilter === grade ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {grade === "all" ? "All Grades" : `Grade ${grade}`}
              </button>
            ))}
          </div>

          {/* Board filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Board:</span>
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
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  boardFilter === b.id ? "bg-indigo-600 text-white" : "bg-slate-800/80 text-slate-400 hover:text-white"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-slate-500 ml-auto">{filteredTemplates.length} templates</span>
        </div>

        {/* Templates Grid */}
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
                className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-blue-500/60 hover:bg-slate-800/40 cursor-pointer shadow-sm hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          tmpl.difficulty === "Beginner"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : tmpl.difficulty === "Intermediate"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                        }`}
                      >
                        {tmpl.difficulty}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${boardMeta.color}`}>
                        <Cpu size={10} />
                        {boardMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Layers size={12} />
                      <span>{tmpl.circuit.parts.length} parts</span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition mb-2">
                    {tmpl.title}
                  </h3>

                  {/* How it works description */}
                  <div className="mb-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5">
                    <div className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                      <span>💡</span>
                      <span>How this project works</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">{tmpl.description}</p>
                  </div>
                  
                  <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-bold text-blue-300 border border-blue-500/20">
                      Grade {tmpl.gradeBand ?? "6-8"}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-semibold text-slate-400">
                      {tmpl.unit ?? "Core Lab"}
                    </span>
                  </div>

                  {tmpl.tutorial?.length ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                      <div className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-400">
                        <span>📋</span>
                        <span>Step-by-step instructions</span>
                      </div>
                      <ol className="space-y-1.5">
                        {tmpl.tutorial.map((step, index) => (
                          <li key={step} className="flex items-start gap-2 text-[10px] leading-4 text-slate-300">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-mono text-[9px] font-bold text-blue-300 border border-blue-400/30 mt-0.5">
                              {index + 1}
                            </span>
                            <span className="flex-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-3">
                  <div className="flex flex-wrap gap-1">
                    {tmpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition">
                    <span>Load</span>
                    <Check size={13} />
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
