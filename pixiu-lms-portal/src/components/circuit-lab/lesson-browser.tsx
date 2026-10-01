"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Check, Circle, Lock, Play, RotateCcw, Search, X, Zap } from "lucide-react"
import type { Lesson, LessonContext, LessonProgress } from "@/lib/lesson-engine"
import {
  LESSONS,
  evaluateLessonStep,
  getLessonProgressPercent,
  getUnlockedLessonIds,
  loadLessonProgress,
  markStepComplete,
  resetLessonProgress,
} from "@/lib/lesson-engine"

interface Props {
  isOpen: boolean
  onClose: () => void
  context: LessonContext
  activeLessonId: string | null
  onSelectLesson: (lesson: Lesson) => void
  onLoadLesson: (lesson: Lesson) => void
}

function difficultyClass(difficulty: Lesson["difficulty"]) {
  if (difficulty === "Beginner") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (difficulty === "Intermediate") return "border-amber-500/30 bg-amber-500/10 text-amber-300"
  return "border-violet-500/30 bg-violet-500/10 text-violet-300"
}

export function LessonBrowser({
  isOpen,
  onClose,
  context,
  activeLessonId,
  onSelectLesson,
  onLoadLesson,
}: Props) {
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [lastResults, setLastResults] = useState<Record<string, ReturnType<typeof evaluateLessonStep>>>({})
  const [categoryFilter, setCategoryFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (isOpen) setProgress(loadLessonProgress())
  }, [isOpen])

  const unlocked = useMemo(() => getUnlockedLessonIds(progress), [progress])
  const activeLesson = LESSONS.find((lesson) => lesson.id === activeLessonId) ?? null
  const activeProgress = activeLesson ? progress[activeLesson.id] : undefined
  const activePercent = activeLesson ? getLessonProgressPercent(activeLesson, activeProgress) : 0

  const counts = useMemo(() => ({
    all: LESSONS.length,
    beginner: LESSONS.filter((l) => l.difficulty === "Beginner").length,
    intermediate: LESSONS.filter((l) => l.difficulty === "Intermediate").length,
    advanced: LESSONS.filter((l) => l.difficulty === "Advanced").length,
  }), [])

  const filteredLessons = useMemo(() => {
    return LESSONS.filter((lesson) => {
      if (categoryFilter !== "all" && lesson.difficulty !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = lesson.title.toLowerCase().includes(q) || lesson.shortTitle.toLowerCase().includes(q)
        const matchDesc = lesson.description.toLowerCase().includes(q)
        const matchConcepts = lesson.concepts.some((c) => c.toLowerCase().includes(q))
        if (!matchTitle && !matchDesc && !matchConcepts) return false
      }
      return true
    })
  }, [categoryFilter, searchQuery])

  if (!isOpen) return null

  const checkStep = (lesson: Lesson, stepId: string) => {
    const step = lesson.steps.find((item) => item.id === stepId)
    if (!step) return
    const result = evaluateLessonStep(lesson, step, context)
    setLastResults((current) => ({ ...current, [`${lesson.id}:${step.id}`]: result }))
    if (result.passed) {
      setProgress((current) => markStepComplete(current, lesson, step.id))
    }
  }

  const resetLesson = (lesson: Lesson) => {
    setProgress((current) => resetLessonProgress(current, lesson.id))
    setLastResults((current) => {
      const next = { ...current }
      lesson.steps.forEach((step) => delete next[`${lesson.id}:${step.id}`])
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(88vh,820px)] w-full max-w-6xl overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#08111f] text-white shadow-2xl shadow-black/60">
        <aside className="hidden w-[340px] shrink-0 border-r border-slate-800 bg-slate-950/50 md:flex md:flex-col">
          <div className="border-b border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black"><BookOpen size={17} className="text-cyan-300" />Interactive Missions</div>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Step-by-step verified electronics & AI curriculum.</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={17} /></button>
            </div>

            {/* Quick search input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search missions, parts, AI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            {/* Category filter tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900/60 p-1 text-[9px] font-bold">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`rounded-lg py-1 transition ${categoryFilter === "all" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
              >
                All ({counts.all})
              </button>
              <button
                onClick={() => setCategoryFilter("Beginner")}
                className={`rounded-lg py-1 transition ${categoryFilter === "Beginner" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Basic ({counts.beginner})
              </button>
              <button
                onClick={() => setCategoryFilter("Intermediate")}
                className={`rounded-lg py-1 transition ${categoryFilter === "Intermediate" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Med ({counts.intermediate})
              </button>
              <button
                onClick={() => setCategoryFilter("Advanced")}
                className={`rounded-lg py-1 transition ${categoryFilter === "Advanced" ? "bg-violet-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
              >
                Adv & AI ({counts.advanced})
              </button>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredLessons.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No missions match your filter.</div>
            ) : (
              filteredLessons.map((lesson) => {
                const locked = !unlocked.has(lesson.id)
                const percent = getLessonProgressPercent(lesson, progress[lesson.id])
                return (
                  <button
                    key={lesson.id}
                    disabled={locked}
                    onClick={() => onSelectLesson(lesson)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      activeLesson?.id === lesson.id
                        ? "border-cyan-400/35 bg-cyan-400/[0.07]"
                        : locked
                          ? "border-slate-800 bg-slate-950/40 opacity-60"
                          : "border-slate-800 bg-slate-950/25 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-cyan-300 ring-1 ring-slate-800">
                        {locked ? <Lock size={14} /> : percent === 100 ? <Check size={14} /> : <Circle size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-white">{lesson.shortTitle}</p>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${difficultyClass(lesson.difficulty)}`}>
                            {lesson.difficulty}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-500">{lesson.description}</p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[8px] font-mono text-slate-600">
                          <span>{percent}% complete</span>
                          <span>{lesson.estimatedMinutes} min</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-cyan-300">Mission control</p>
              <h2 className="mt-0.5 truncate text-base font-black sm:text-lg">{activeLesson?.title ?? "Select a mission"}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {activeLesson && (
                <button
                  onClick={() => resetLesson(activeLesson)}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
                  title="Reset lesson progress"
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white md:hidden"><X size={17} /></button>
            </div>
          </div>

          <div className="md:hidden border-b border-slate-800 bg-slate-950/35 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500"><BookOpen size={12} className="text-cyan-300" /> Missions</div>
              <div className="flex gap-1 text-[8px]">
                <button onClick={() => setCategoryFilter("all")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400"}`}>All</button>
                <button onClick={() => setCategoryFilter("Beginner")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Beginner" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400"}`}>Basic</button>
                <button onClick={() => setCategoryFilter("Intermediate")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Intermediate" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"}`}>Med</button>
                <button onClick={() => setCategoryFilter("Advanced")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Advanced" ? "bg-violet-500 text-slate-950 font-bold" : "text-slate-400"}`}>Adv</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
              {filteredLessons.map((lesson) => {
                const locked = !unlocked.has(lesson.id)
                const percent = getLessonProgressPercent(lesson, progress[lesson.id])
                return (
                  <button
                    key={lesson.id}
                    disabled={locked}
                    onClick={() => onSelectLesson(lesson)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${activeLesson?.id === lesson.id ? "border-cyan-400/30 bg-cyan-400/[0.06]" : "border-slate-800 bg-slate-900/40"} disabled:opacity-40`}
                  >
                    {locked ? <Lock size={12} className="text-slate-600" /> : percent === 100 ? <Check size={12} className="text-emerald-300" /> : <Circle size={12} className="text-cyan-300" />}
                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-200">{lesson.shortTitle}</span>
                    <span className="font-mono text-[8px] text-slate-600">{percent}%</span>
                  </button>
                )
              })}
            </div>
          </div>

          {!activeLesson ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/20"><BookOpen size={24} /></div>
                <h3 className="mt-4 text-lg font-black">Choose your first mission</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">Complete lessons in order. Each lesson gives you a starter circuit, guided steps and automatic checks for wiring, Blockly blocks and live simulation.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {LESSONS.slice(0, 4).map((lesson, index) => (
                    <button key={lesson.id} onClick={() => unlocked.has(lesson.id) && onSelectLesson(lesson)} disabled={!unlocked.has(lesson.id)} className="rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 text-[9px] font-semibold text-slate-400 disabled:opacity-40">{index + 1}. {lesson.shortTitle}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-800 bg-slate-950/25 px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeLesson.concepts.map((concept) => <span key={concept} className="rounded-full bg-slate-900 px-2 py-1 text-[9px] font-mono text-slate-400 ring-1 ring-slate-800">{concept}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="max-w-2xl text-[11px] leading-5 text-slate-400">{activeLesson.description}</p>
                  <button onClick={() => { onLoadLesson(activeLesson); setLastResults((current) => { const next = { ...current }; activeLesson.steps.forEach((step) => delete next[`${activeLesson.id}:${step.id}`]); return next }) }} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-[10px] font-black text-slate-950 hover:bg-cyan-400">
                    <Play size={12} fill="currentColor" /> Load starter
                  </button>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[9px] font-mono text-slate-500"><span>{activePercent}% complete</span><span>{activeLesson.steps.length} steps</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${activePercent}%` }} /></div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-3">
                  {activeLesson.steps.map((step, index) => {
                    const done = Boolean(activeProgress?.completedStepIds.includes(step.id))
                    const result = lastResults[`${activeLesson.id}:${step.id}`]
                    const previousDone = index === 0 || Boolean(activeProgress?.completedStepIds.includes(activeLesson.steps[index - 1].id))
                    const locked = !previousDone && !done
                    return (
                      <div key={step.id} className={`rounded-2xl border p-4 ${done ? "border-emerald-500/25 bg-emerald-500/[0.04]" : locked ? "border-slate-800 bg-slate-950/30 opacity-60" : "border-slate-700 bg-slate-950/45"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black ${done ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-900 text-cyan-300 ring-1 ring-slate-800"}`}>
                            {done ? <Check size={15} /> : index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-white">{step.title}</p>
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">{step.kind}</p>
                              </div>
                              <button
                                onClick={() => checkStep(activeLesson, step.id)}
                                disabled={locked || done}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Zap size={12} /> Check step
                              </button>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-400">{step.instructions}</p>
                            {result && (
                              <div className={`mt-3 rounded-xl border px-3 py-2 ${result.passed ? "border-emerald-500/20 bg-emerald-500/10" : "border-amber-500/20 bg-amber-500/10"}`}>
                                <p className={`text-[10px] font-bold ${result.passed ? "text-emerald-300" : "text-amber-300"}`}>{result.summary}</p>
                                <div className="mt-2 space-y-1">
                                  {result.results.map((item, resultIndex) => (
                                    <div key={`${item.label}-${resultIndex}`} className="flex items-center justify-between gap-3 text-[9px]">
                                      <span className="text-slate-400">{item.label}</span>
                                      <span className={item.passed ? "text-emerald-300" : "text-amber-300"}>{item.detail}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-slate-800 px-4 py-2.5 text-[9px] text-slate-600 sm:px-6">
            <span>Progress is stored locally on this device. Circuit work remains in the Lab.</span>
          </div>
        </section>
      </div>
    </div>
  )
}
