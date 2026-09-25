import React, { useMemo, useState } from "react"
import { X, Sparkles, BookOpen, Layers, Check } from "lucide-react"
import { TEMPLATES, type ProjectTemplate, type TemplateGrade } from "@/lib/templates"

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ProjectTemplate) => void
}

export const TemplateBrowser: React.FC<Props> = ({ isOpen, onClose, onSelectTemplate }) => {
  const [gradeFilter, setGradeFilter] = useState<"all" | TemplateGrade>("all")
  const filteredTemplates = useMemo(() => gradeFilter === "all" ? TEMPLATES : TEMPLATES.filter((template) => template.gradeBand === gradeFilter), [gradeFilter])
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700/80 bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
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

        {/* Templates Grid */}
        <div className="border-b border-slate-800 px-6 py-3 flex flex-wrap items-center gap-2">{["all", 6, 7, 8].map((grade) => <button key={String(grade)} onClick={() => setGradeFilter(grade as "all" | TemplateGrade)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${gradeFilter === grade ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>{grade === "all" ? "All Grades" : `Grade ${grade}`}</button>)}<span className="ml-auto text-[10px] font-mono text-slate-500">{filteredTemplates.length} starter projects</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto">
          {filteredTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl)
                onClose()
              }}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-5 transition hover:border-blue-500/60 hover:bg-slate-800/40 cursor-pointer shadow-sm hover:shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
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
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Layers size={12} />
                    <span>{tmpl.circuit.parts.length} parts</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition mb-1">
                  {tmpl.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{tmpl.description}</p><div className="mb-3 flex items-center gap-2 flex-wrap"><span className="rounded-full bg-blue-500/10 px-2 py-1 text-[9px] font-bold text-blue-300 border border-blue-500/20">Grade {tmpl.gradeBand ?? "6-8"}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-semibold text-slate-400">{tmpl.unit ?? "Core Lab"}</span></div>{tmpl.tutorial?.length ? <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2.5"><div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Guided steps</div><ol className="space-y-1">{tmpl.tutorial.slice(0, 3).map((step, index) => <li key={step} className="flex gap-2 text-[9px] leading-4 text-slate-400"><span className="font-mono text-blue-400">{index + 1}.</span><span>{step}</span></li>)}</ol></div> : null}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
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
          ))}
        </div>
      </div>
    </div>
  )
}
