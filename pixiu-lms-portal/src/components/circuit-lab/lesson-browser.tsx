"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Activity, BookOpen, Check, Circle, Cloud, Lightbulb, Lock, Play, RotateCcw, Search, Send, ShieldCheck, Sparkles, Target, Wrench, X, Zap } from "lucide-react"
import type { CircuitState } from "@/lib/circuit-types"
import type { Lesson, LessonContext, LessonProgress } from "@/lib/lesson-engine"
import { diagnoseCircuit } from "@/lib/circuit-doctor"
import { MODEL_REFERENCE_CASES, getLiveModelEvidence } from "@/lib/virtual-lab-reference"
import { apiFetch } from "@/context/AuthContext"
import type { CircuitCopilotProposal, UseCircuitCopilotActionResult } from "./use-circuit-copilot-action"
import {
  LESSONS,
  evaluateLessonStep,
  getLessonProgressPercent,
  getUnlockedLessonIds,
  loadLessonProgress,
  saveLessonProgress,
  markStepComplete,
  resetLessonProgress,
} from "@/lib/lesson-engine"
import { awardMissionXp } from "@/lib/xp-engine"

interface RemoteProgress {
  id: string
  status: "in_progress" | "submitted" | "reviewed"
  completed_step_ids: string[]
  snapshot?: { circuit?: CircuitState; blocklyXml?: string }
  result_summary: { completion_percent?: number; completed_steps?: number; total_steps?: number }
  reflection: string
  feedback: string
  student?: { id: string; name: string; roll_number: number }
}
interface RemoteAssignment {
  id: string
  class_id: string
  class_name: string
  lesson_id: string
  title: string
  due_date: string | null
  my_progress?: RemoteProgress | null
  submissions?: RemoteProgress[]
}
interface RemoteClass {
  id: string
  display_name?: string
  grade?: string
  section?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  context: LessonContext
  activeLessonId: string | null
  onSelectLesson: (lesson: Lesson) => void
  onLoadLesson: (lesson: Lesson, snapshot?: { circuit?: CircuitState; blocklyXml?: string }) => void
  userRole?: string
  userKey?: string
  copilotAction?: UseCircuitCopilotActionResult
  onHighlightParts?: (partIds: string[]) => void
  onOpenCopilot?: () => void
}

async function virtualLabRequest<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown): Promise<T> {
  const bodyText = body !== undefined ? JSON.stringify(body) : undefined
  if (bodyText && new TextEncoder().encode(bodyText).length > 60000) {
    throw new Error("This circuit snapshot is too large to sync. Reduce the number of parts or saved code, then try again.")
  }
  const response = await apiFetch(path, {
    method,
    cache: "no-store",
    ...(bodyText !== undefined ? { body: bodyText, headers: { "Content-Type": "application/json" } } : {}),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof payload?.detail === "string" ? payload.detail : typeof payload?.error === "string" ? payload.error : "Virtual Lab service is unavailable."
    throw new Error(message)
  }
  return payload as T
}

function listFromPayload<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (!payload || typeof payload !== "object") return []
  const value = (payload as Record<string, unknown>)[key]
  if (Array.isArray(value)) return value as T[]
  const results = (payload as Record<string, unknown>).results
  return Array.isArray(results) ? results as T[] : []
}

function missionHint(lesson: Lesson, step: Lesson["steps"][number], level: number, failed: ReturnType<typeof evaluateLessonStep> | undefined) {
  if (level <= 0) return ""
  const firstFailure = failed?.results.find((item) => !item.passed)
  if (level === 1) return "For " + cleanDisplayText(lesson.shortTitle) + ", start with the evidence this checkpoint asks for. Compare the circuit or program on the canvas with the stated goal before changing anything."
  if (level === 2) {
    if (firstFailure) return "The current check reports: " + firstFailure.label + " — " + firstFailure.detail + ". Focus on that one requirement, then check again."
    return "For this " + step.kind + " step, use the live circuit status and the values shown by the simulator. Change one thing at a time so you can see what caused the result."
  }
  const firstCheck = step.checks[0]
  if (firstCheck?.kind === "parts") return "Count the required parts on the canvas. Add the missing component from the parts palette, then run Check step again."
  if (firstCheck?.kind === "connections") return "Trace the named pins in the connection check from source to load and back to ground. Rewire one connection, then check the circuit."
  if (firstCheck?.kind === "blocks") return "In Blockly, place the required block inside the Arduino program and verify its field values. Then run the program and recheck this step."
  if (firstCheck?.kind === "running") return "Start the simulator after checking power, ground, and the required connections. The step passes only when the program is running."
  if (firstCheck?.kind === "runtime" || firstCheck?.kind === "runtime-any") return "Run the circuit and compare its displayed reading with the target in the instructions. Adjust one component value or input at a time."
  return "Review the failed requirement above, make the smallest change that addresses it, and verify the result again."
}

function cleanDisplayText(value: string) {
  return Array.from(value).filter((character) => {
    const point = character.codePointAt(0) || 0
    return !((point >= 0x1f300 && point <= 0x1faff) || (point >= 0x2600 && point <= 0x27bf))
  }).join("").replace(/\s+/g, " ").trim()
}

function difficultyClass(difficulty: Lesson["difficulty"]) {
  if (difficulty === "Beginner") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  if (difficulty === "Intermediate") return "border-amber-500/30 bg-amber-500/10 text-amber-300"
  return "border-violet-500/30 bg-violet-500/10 text-violet-300"
}

function boardBadge(board?: Lesson["board"]) {
  switch (board) {
    case "esp32-devkit":
      return { label: "ESP32", color: "border-red-500/30 bg-red-500/10 text-red-300" }
    case "rpi-pico":
      return { label: "Pico", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" }
    case "microbit-v2":
      return { label: "micro:bit", color: "border-amber-500/30 bg-amber-500/10 text-amber-300" }
    case "arduino-uno":
    default:
      return { label: "Uno", color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" }
  }
}

export function LessonBrowser({
  isOpen,
  onClose,
  context,
  activeLessonId,
  onSelectLesson,
  onLoadLesson,
  userRole,
  userKey,
  copilotAction,
  onHighlightParts,
  onOpenCopilot,
}: Props) {
  const normalizedRole = String(userRole || "").toLowerCase()
  const isStudent = normalizedRole === "student"
  const canManageAssignments = ["admin", "school", "trainer"].includes(normalizedRole)
  const canReviewAssignments = normalizedRole === "admin" || normalizedRole === "trainer"
  const progressScope = userKey ? normalizedRole + ":" + userKey : undefined
  const [progress, setProgress] = useState<Record<string, LessonProgress>>({})
  const [lastResults, setLastResults] = useState<Record<string, ReturnType<typeof evaluateLessonStep>>>({})
  const [boardFilter, setBoardFilter] = useState<"all" | "arduino-uno" | "esp32-devkit" | "rpi-pico" | "microbit-v2">("all")
  const [categoryFilter, setCategoryFilter] = useState<"all" | "Beginner" | "Intermediate" | "Advanced">("all")
  const [aiOnly, setAiOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [hintLevels, setHintLevels] = useState<Record<string, number>>({})
  const [showCircuitCheck, setShowCircuitCheck] = useState(false)
  const [assignments, setAssignments] = useState<RemoteAssignment[]>([])
  const [classes, setClasses] = useState<RemoteClass[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [teacherToolsOpen, setTeacherToolsOpen] = useState(false)
  const [cloudState, setCloudState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle")
  const [cloudError, setCloudError] = useState("")
  const [missionStarted, setMissionStarted] = useState(false)
  const [reflection, setReflection] = useState("")
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [submissionSaving, setSubmissionSaving] = useState(false)
  const [reviewSavingId, setReviewSavingId] = useState("")
  const [reviewFeedback, setReviewFeedback] = useState<Record<string, string>>({})
  const syncTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (isOpen) setProgress(loadLessonProgress(progressScope))
  }, [isOpen, progressScope])

  useEffect(() => {
    setMissionStarted(false)
    setShowCircuitCheck(false)
    setReflection("")
  }, [activeLessonId])

  useEffect(() => {
    if (!isOpen || (!isStudent && !canManageAssignments)) return
    let cancelled = false
    setCloudState("loading")
    Promise.all([
      virtualLabRequest<{ assignments?: RemoteAssignment[] }>("/virtual-lab/assignments"),
      canManageAssignments ? virtualLabRequest("/classes") : Promise.resolve(null),
    ]).then(([assignmentPayload, classPayload]) => {
      if (cancelled) return
      const nextAssignments = listFromPayload<RemoteAssignment>(assignmentPayload, "assignments")
      setAssignments(nextAssignments)
      if (canManageAssignments) {
        setClasses(listFromPayload<RemoteClass>(classPayload, "classes").filter((item) => (item as RemoteClass & { status?: string }).status !== "inactive"))
      } else {
        setProgress((current) => {
          const next = { ...current }
          const latestAssignmentByLesson = new Set<string>()
          for (const assignment of nextAssignments) {
            if (latestAssignmentByLesson.has(assignment.lesson_id)) continue
            latestAssignmentByLesson.add(assignment.lesson_id)
            if (!assignment.my_progress) continue
            next[assignment.lesson_id] = {
              completedStepIds: assignment.my_progress.completed_step_ids || [],
              startedAt: assignment.my_progress.submitted_at || undefined,
              completedAt: assignment.my_progress.status === "submitted" || assignment.my_progress.status === "reviewed" ? assignment.my_progress.submitted_at || undefined : undefined,
            }
          }
          return next
        })
      }
      setCloudState("saved")
      setCloudError("")
    }).catch((error) => {
      if (cancelled) return
      setCloudState("error")
      setCloudError(error instanceof Error ? error.message : "Could not load class missions.")
    })
    return () => { cancelled = true }
  }, [isOpen, isStudent, canManageAssignments, progressScope])

  const activeLesson = LESSONS.find((lesson) => lesson.id === activeLessonId) ?? null
  const activeAssignment = activeLesson ? assignments.find((item) => item.lesson_id === activeLesson.id) ?? null : null
  const activeProgress = activeLesson
    ? isStudent && activeAssignment
      ? missionStarted
        ? progress[activeLesson.id]
        : { completedStepIds: activeAssignment.my_progress?.completed_step_ids || [] }
      : progress[activeLesson.id]
    : undefined
  const activePercent = activeLesson ? getLessonProgressPercent(activeLesson, activeProgress) : 0
  const nextStep = activeLesson ? activeLesson.steps.find((step) => !activeProgress?.completedStepIds.includes(step.id)) ?? activeLesson.steps[activeLesson.steps.length - 1] ?? null : null
  const nextStepKey = activeLesson && nextStep ? activeLesson.id + ":" + nextStep.id : ""
  const nextStepResult = activeLesson && nextStep ? lastResults[nextStepKey] : undefined
  const guideLevel = nextStepKey ? hintLevels[nextStepKey] || 0 : 0
  const circuitReport = useMemo(() => diagnoseCircuit(context.state, context.runtime), [context.state, context.runtime])
  const liveEvidence = useMemo(() => getLiveModelEvidence(context.state, context.runtime), [context.state, context.runtime])
  const myAssignmentProgress = activeAssignment?.my_progress ?? null
  const assignmentLocked = myAssignmentProgress?.status === "submitted" || myAssignmentProgress?.status === "reviewed"
  const hasSavedSnapshot = Boolean(myAssignmentProgress?.snapshot?.circuit && Array.isArray(myAssignmentProgress.snapshot.circuit.parts))
  const reviewItems = assignments.filter((item) => item.lesson_id === activeLesson?.id).flatMap((item) => (item.submissions || []).map((submission) => ({ ...submission, assignmentId: item.id, assignmentTitle: item.title })))

  useEffect(() => {
    if (isStudent && activeAssignment) setReflection(activeAssignment.my_progress?.reflection || "")
  }, [isStudent, activeAssignment?.id, activeAssignment?.my_progress?.id])


  const unlocked = useMemo(() => getUnlockedLessonIds(progress), [progress])

  const counts = useMemo(() => ({
    all: LESSONS.length,
    beginner: LESSONS.filter((l) => l.difficulty === "Beginner").length,
    intermediate: LESSONS.filter((l) => l.difficulty === "Intermediate").length,
    advanced: LESSONS.filter((l) => l.difficulty === "Advanced").length,
    uno: LESSONS.filter((l) => (l.board ?? "arduino-uno") === "arduino-uno").length,
    esp32: LESSONS.filter((l) => l.board === "esp32-devkit").length,
    pico: LESSONS.filter((l) => l.board === "rpi-pico").length,
    microbit: LESSONS.filter((l) => l.board === "microbit-v2").length,
  }), [])

  const filteredLessons = useMemo(() => {
    return LESSONS.filter((lesson) => {
      const lessonBoard = lesson.board ?? "arduino-uno"
      if (boardFilter !== "all" && lessonBoard !== boardFilter) return false
      if (categoryFilter !== "all" && lesson.difficulty !== categoryFilter) return false
      if (aiOnly && !lesson.concepts.some((concept) => /ai|vision|gesture|finger|computer vision/i.test(concept)) && !/AI/i.test(lesson.title)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = lesson.title.toLowerCase().includes(q) || lesson.shortTitle.toLowerCase().includes(q)
        const matchDesc = lesson.description.toLowerCase().includes(q)
        const matchConcepts = lesson.concepts.some((c) => c.toLowerCase().includes(q))
        const matchBoard = lessonBoard.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchConcepts && !matchBoard) return false
      }
      return true
    })
  }, [aiOnly, boardFilter, categoryFilter, searchQuery])

  useEffect(() => {
    if (!isStudent || !activeAssignment || !activeLesson || !missionStarted || assignmentLocked) return
    const timeout = window.setTimeout(async () => {
      setCloudState("saving")
      setCloudError("")
      try {
        const currentProgress = progress[activeLesson.id]
        await virtualLabRequest("/virtual-lab/assignments/" + encodeURIComponent(activeAssignment.id) + "/progress", "POST", {
          completed_step_ids: currentProgress?.completedStepIds || [],
          snapshot: { circuit: context.state, blocklyXml: context.blocklyXml },
          result_summary: { completion_percent: activePercent, completed_steps: currentProgress?.completedStepIds?.length || 0, total_steps: activeLesson.steps.length },
          reflection,
        })
        setCloudState("saved")
      } catch (error) {
        setCloudState("error")
        setCloudError(error instanceof Error ? error.message : "Progress could not be synchronized.")
      }
    }, 1200)
    syncTimerRef.current = timeout
    return () => {
      window.clearTimeout(timeout)
      if (syncTimerRef.current === timeout) syncTimerRef.current = null
    }
  }, [isStudent, activeAssignment?.id, activeLesson?.id, missionStarted, assignmentLocked, activeProgress, activePercent, context.state, context.blocklyXml, reflection])

  if (!isOpen) return null

  const checkStep = (lesson: Lesson, stepId: string) => {
    const step = lesson.steps.find((item) => item.id === stepId)
    if (!step) return
    const result = evaluateLessonStep(lesson, step, context)
    setLastResults((current) => ({ ...current, [`${lesson.id}:${step.id}`]: result }))
    if (result.passed) {
      const wasCompleted = (progress[lesson.id]?.completedStepIds?.length ?? 0) >= lesson.steps.length
      const nextProgress = markStepComplete(progress, lesson, step.id, progressScope)
      setProgress(nextProgress)
      const isCompleted = (nextProgress[lesson.id]?.completedStepIds?.length ?? 0) >= lesson.steps.length
      if (!wasCompleted && isCompleted) {
        awardMissionXp(lesson.id, lesson.difficulty, lesson.shortTitle || lesson.title)
      }
    }
  }

  const resetLesson = (lesson: Lesson) => {
    if (assignmentLocked) return
    setMissionStarted(false)
    setProgress((current) => resetLessonProgress(current, lesson.id, progressScope))
    setLastResults((current) => {
      const next = { ...current }
      lesson.steps.forEach((step) => delete next[`${lesson.id}:${step.id}`])
      return next
    })
  }

  const refreshAssignments = async () => {
    const payload = await virtualLabRequest<{ assignments?: RemoteAssignment[] }>("/virtual-lab/assignments")
    setAssignments(listFromPayload<RemoteAssignment>(payload, "assignments"))
  }

  const assignActiveMission = async () => {
    if (!activeLesson || !selectedClassId) return
    setAssignmentSaving(true)
    setCloudError("")
    try {
      await virtualLabRequest("/virtual-lab/assignments", "POST", {
        school_class: selectedClassId,
        lesson_id: activeLesson.id,
        title: activeLesson.shortTitle || activeLesson.title,
        due_date: dueDate || null,
      })
      await refreshAssignments()
      setTeacherToolsOpen(false)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "The mission could not be assigned.")
    } finally {
      setAssignmentSaving(false)
    }
  }

  const submitActiveMission = async () => {
    if (!activeLesson || !activeAssignment) return
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    setSubmissionSaving(true)
    setCloudError("")
    try {
      await virtualLabRequest("/virtual-lab/assignments/" + encodeURIComponent(activeAssignment.id) + "/submit", "POST", {
        completed_step_ids: progress[activeLesson.id]?.completedStepIds || [],
        snapshot: { circuit: context.state, blocklyXml: context.blocklyXml },
        result_summary: { completion_percent: activePercent, completed_steps: progress[activeLesson.id]?.completedStepIds?.length || 0, total_steps: activeLesson.steps.length },
        reflection,
      })
      await refreshAssignments()
      setCloudState("saved")
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Submission could not be saved.")
    } finally {
      setSubmissionSaving(false)
    }
  }

  const reviewSubmission = async (assignmentId: string, progressId: string) => {
    setReviewSavingId(progressId)
    setCloudError("")
    try {
      await virtualLabRequest("/virtual-lab/assignments/" + encodeURIComponent(assignmentId) + "/review", "POST", {
        progress_id: progressId,
        feedback: reviewFeedback[progressId] || "",
      })
      await refreshAssignments()
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Review could not be saved.")
    } finally {
      setReviewSavingId("")
    }
  }

  const stagePolarityCorrection = (partId: string) => {
    if (!activeLesson || !copilotAction) return
    const wires = context.state.wires.map((wire) => {
      const reversePin = (endpoint: typeof wire.from) => {
        if (endpoint.partId !== partId) return endpoint
        if (endpoint.pinId === "anode") return { ...endpoint, pinId: "cathode" }
        if (endpoint.pinId === "cathode") return { ...endpoint, pinId: "anode" }
        return endpoint
      }
      return { ...wire, from: reversePin(wire.from), to: reversePin(wire.to) }
    })
    const proposal: CircuitCopilotProposal = {
      id: "8-square-led-polarity-" + partId + "-" + Date.now(),
      title: "Correct LED polarity",
      rationale: "The circuit check found the LED anode and cathode connected in reverse. This preview swaps only the two LED wire endpoints; review the change before applying it.",
      baseRevisionHash: copilotAction.currentHash,
      circuit: { ...context.state, wires },
      codeLanguage: "blockly",
    }
    const checked = copilotAction.proposeAction(proposal)
    if (checked.valid) copilotAction.stageProposal(proposal)
  }

  const applyStagedGuideFix = () => {
    if (copilotAction?.stagedPreview?.proposal.title === "Correct LED polarity") copilotAction.applyProposal()
  }

  const startOrResumeMission = () => {
    if (!activeLesson) return
    if (isStudent && activeAssignment) {
      const savedSteps = myAssignmentProgress?.completed_step_ids || []
      const nextProgress = {
        ...progress,
        [activeLesson.id]: { ...(progress[activeLesson.id] || { completedStepIds: [] }), completedStepIds: savedSteps },
      }
      setProgress(nextProgress)
      saveLessonProgress(nextProgress, progressScope)
    }
    onLoadLesson(activeLesson, hasSavedSnapshot ? myAssignmentProgress?.snapshot : undefined)
    setMissionStarted(true)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex h-[min(88dvh,820px)] max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#08111f] text-white shadow-2xl shadow-black/60">
        <aside className="hidden w-[340px] shrink-0 border-r border-slate-800 bg-slate-950/50 md:flex md:flex-col">
          <div className="border-b border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black"><BookOpen size={17} className="text-cyan-300" />Interactive Missions</div>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Step-by-step verified electronics & AI curriculum.</p>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"><X size={17} /></button>
            </div>

            {isStudent && assignments.length > 0 && (
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                <div className="flex items-center justify-between"><p className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-slate-500">Assigned missions</p><span className="text-[9px] text-slate-600">{assignments.length} available</span></div>
                {assignments.map((assignment) => {
                  const assignedLesson = LESSONS.find((lesson) => lesson.id === assignment.lesson_id)
                  const record = assignment.my_progress
                  return assignedLesson ? (
                    <button key={assignment.id} type="button" onClick={() => onSelectLesson(assignedLesson)} className="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-left transition hover:border-cyan-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                      <span className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-slate-200">{assignment.title}</span><span className="shrink-0 text-[8px] uppercase tracking-wide text-cyan-300">{record?.status === "reviewed" ? "Reviewed" : record?.status === "submitted" ? "Submitted" : "Assigned"}</span></span>
                      <span className="mt-1 block text-[9px] text-slate-500">{assignment.due_date ? "Due " + assignment.due_date : assignment.class_name}</span>
                    </button>
                  ) : null
                })}
              </div>
            )}

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

            {/* Board Architecture filter tabs */}
            <div>
              <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-slate-400">Board Architecture</div>
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-slate-900/80 p-1 text-[9px] font-bold">
                <button
                  onClick={() => setBoardFilter("all")}
                  className={`rounded-lg py-1 transition ${boardFilter === "all" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  All ({counts.all})
                </button>
                <button
                  onClick={() => setBoardFilter("arduino-uno")}
                  className={`rounded-lg py-1 transition ${boardFilter === "arduino-uno" ? "bg-cyan-400 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  Uno ({counts.uno})
                </button>
                <button
                  onClick={() => setBoardFilter("esp32-devkit")}
                  className={`rounded-lg py-1 transition ${boardFilter === "esp32-devkit" ? "bg-red-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  ESP32 ({counts.esp32})
                </button>
                <button
                  onClick={() => setBoardFilter("rpi-pico")}
                  className={`rounded-lg py-1 transition ${boardFilter === "rpi-pico" ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  Pico ({counts.pico})
                </button>
                <button
                  onClick={() => setBoardFilter("microbit-v2")}
                  className={`rounded-lg py-1 transition ${boardFilter === "microbit-v2" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  micro ({counts.microbit})
                </button>
              </div>
            </div>

            {/* Category filter tabs */}
            <div>
              <div className="mb-1 text-[9px] font-mono uppercase tracking-wider text-slate-400">Difficulty Tier</div>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900/60 p-1 text-[9px] font-bold">
                <button
                  onClick={() => setCategoryFilter("all")}
                  className={`rounded-lg py-1 transition ${categoryFilter === "all" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"}`}
                >
                  All
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
                  Adv ({counts.advanced})
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredLessons.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No missions match your filter.</div>
            ) : (
              filteredLessons.map((lesson) => {
                const locked = !unlocked.has(lesson.id)
                const percent = getLessonProgressPercent(lesson, progress[lesson.id])
                const badge = boardBadge(lesson.board)
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
                        <div className="flex items-center justify-between gap-1.5">
                          <p className="truncate text-xs font-bold text-white">{cleanDisplayText(lesson.shortTitle)}</p>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className={`rounded-md border px-1.5 py-0.5 text-[8px] font-mono font-bold ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${difficultyClass(lesson.difficulty)}`}>
                              {lesson.difficulty}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300 font-medium">
                          {cleanDisplayText(lesson.finalGoal || lesson.description)}
                        </p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
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
              <h2 className="mt-0.5 truncate text-base font-black sm:text-lg">{activeLesson ? cleanDisplayText(activeLesson.title) : "Select a mission"}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {activeLesson && (
                <button
                  onClick={() => resetLesson(activeLesson)}
                  disabled={assignmentLocked}
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  title={assignmentLocked ? "Submitted work is locked for teacher review" : "Reset lesson progress"}
                  aria-label="Reset lesson progress"
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white md:hidden"><X size={17} /></button>
            </div>
          </div>

          <div className="md:hidden border-b border-slate-800 bg-slate-950/35 p-3 space-y-2">
            {isStudent && assignments.length > 0 && <div className="max-h-32 space-y-1 overflow-y-auto">
              <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Assigned missions</p>
              {assignments.map((assignment) => {
                const assignedLesson = LESSONS.find((lesson) => lesson.id === assignment.lesson_id)
                return assignedLesson ? <button key={assignment.id} type="button" onClick={() => onSelectLesson(assignedLesson)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2 text-left text-[10px] text-slate-200"><span className="min-w-0 truncate">{assignment.title}</span><span className="shrink-0 text-[8px] text-cyan-300">{assignment.my_progress?.status || "Assigned"}</span></button> : null
              })}
            </div>}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500"><BookOpen size={12} className="text-cyan-300" /> Missions</div>
                <div className="flex gap-1 text-[8px]">
                  <button onClick={() => setCategoryFilter("all")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400"}`}>All</button>
                  <button onClick={() => setCategoryFilter("Beginner")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Beginner" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400"}`}>Basic</button>
                  <button onClick={() => setCategoryFilter("Intermediate")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Intermediate" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400"}`}>Med</button>
                  <button onClick={() => setCategoryFilter("Advanced")} className={`px-1.5 py-0.5 rounded ${categoryFilter === "Advanced" ? "bg-violet-500 text-slate-950 font-bold" : "text-slate-400"}`}>Adv</button>
                </div>
              </div>
              <div className="flex gap-1 text-[8px] overflow-x-auto pb-0.5">
                <button onClick={() => setBoardFilter("all")} className={`px-2 py-0.5 rounded whitespace-nowrap ${boardFilter === "all" ? "bg-cyan-500 text-slate-950 font-bold" : "bg-slate-900 text-slate-400"}`}>All Boards</button>
                <button onClick={() => setBoardFilter("arduino-uno")} className={`px-2 py-0.5 rounded whitespace-nowrap ${boardFilter === "arduino-uno" ? "bg-cyan-400 text-slate-950 font-bold" : "bg-slate-900 text-slate-400"}`}>Uno</button>
                <button onClick={() => setBoardFilter("esp32-devkit")} className={`px-2 py-0.5 rounded whitespace-nowrap ${boardFilter === "esp32-devkit" ? "bg-red-500 text-slate-950 font-bold" : "bg-slate-900 text-slate-400"}`}>ESP32</button>
                <button onClick={() => setBoardFilter("rpi-pico")} className={`px-2 py-0.5 rounded whitespace-nowrap ${boardFilter === "rpi-pico" ? "bg-emerald-500 text-slate-950 font-bold" : "bg-slate-900 text-slate-400"}`}>Pico</button>
                <button onClick={() => setBoardFilter("microbit-v2")} className={`px-2 py-0.5 rounded whitespace-nowrap ${boardFilter === "microbit-v2" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-900 text-slate-400"}`}>micro:bit</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
              {filteredLessons.map((lesson) => {
                const locked = !unlocked.has(lesson.id)
                const percent = getLessonProgressPercent(lesson, progress[lesson.id])
                const badge = boardBadge(lesson.board)
                return (
                  <button
                    key={lesson.id}
                    disabled={locked}
                    onClick={() => onSelectLesson(lesson)}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${activeLesson?.id === lesson.id ? "border-cyan-400/30 bg-cyan-400/[0.06]" : "border-slate-800 bg-slate-900/40"} disabled:opacity-40`}
                  >
                    {locked ? <Lock size={12} className="text-slate-600" /> : percent === 100 ? <Check size={12} className="text-emerald-300" /> : <Circle size={12} className="text-cyan-300" />}
                    <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-slate-200">{lesson.shortTitle}</span>
                    <span className={`shrink-0 rounded px-1 py-0.2 text-[7px] font-mono border ${badge.color}`}>{badge.label}</span>
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
                <p className="mt-2 text-xs leading-5 text-slate-500">Choose a mission that fits your level. Beginner missions include starter code; every mission guides you through building, running and checking the result.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {LESSONS.filter((l) => l.prerequisites.length === 0).map((lesson) => {
                    const badge = boardBadge(lesson.board)
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => unlocked.has(lesson.id) && onSelectLesson(lesson)}
                        disabled={!unlocked.has(lesson.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[9px] font-semibold text-slate-300 hover:border-slate-700 hover:text-white disabled:opacity-40"
                      >
                        <span className={`rounded px-1 text-[7px] font-mono border ${badge.color}`}>{badge.label}</span>
                        <span>{cleanDisplayText(lesson.shortTitle)}</span>
                      </button>
                    )
                  })}
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
                  <p className="max-w-2xl text-[11px] leading-5 text-slate-400">{cleanDisplayText(activeLesson.description)}</p>
                  <button
                    type="button"
                    onClick={startOrResumeMission}
                    disabled={assignmentLocked}
                    title={hasSavedSnapshot ? "Resume this mission from your saved circuit and code." : "Start this mission on its guided canvas."}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-[10px] font-black text-slate-950 hover:bg-cyan-400 transition cursor-pointer shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Play size={12} fill="currentColor" />
                    {assignmentLocked ? (myAssignmentProgress?.status === "reviewed" ? "Teacher reviewed" : "Submitted for review") : hasSavedSnapshot ? "Resume saved work" : activeLesson.difficulty === "Beginner" ? "Start mission" : "Start blank mission"}
                  </button>
                </div>

                {/* Beginner Auto-Code Banner */}
                {activeLesson.difficulty === "Beginner" && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-300 font-medium">
                    <Sparkles size={14} className="text-emerald-400 shrink-0" />
                    <span>
                      <strong>Beginner mission:</strong> Starter code is loaded into Blockly. Build the circuit first, then run it and use the mission steps to investigate the result.
                    </span>
                  </div>
                )}

                {/* What You Will Build (Final Project Goal) Banner */}
                {activeLesson.finalGoal && (
                  <div className="mt-3 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900/40 p-3 shadow-inner">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      <Target size={13} className="text-cyan-400 shrink-0" />
                      <span>What You Will Build (Final Project Goal)</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-200 font-medium">
                      {cleanDisplayText(activeLesson.finalGoal)}
                    </p>
                  </div>
                )}

                {/* Step-by-Step Coding Guide & Block Hints for Intermediate & Advanced Missions */}
                {activeLesson.codingHints && activeLesson.codingHints.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/40 to-slate-950/40 p-3 shadow-inner">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                      <Sparkles size={13} className="text-amber-400 shrink-0" />
                      <span>Coding Guide & Block Hints ({activeLesson.difficulty} Mission)</span>
                    </div>
                    <ul className="mt-2 space-y-1.5 text-xs text-slate-300 leading-relaxed font-sans">
                      {activeLesson.codingHints.map((hint, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-300 border border-amber-500/40">
                            {idx + 1}
                          </span>
                          <span className="text-slate-300 text-[11px] leading-snug">{cleanDisplayText(hint)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[9px] font-mono text-slate-500"><span>{activePercent}% complete</span><span>{activeLesson.steps.length} steps</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${activePercent}%` }} /></div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                {nextStep && (
                  <section aria-labelledby="eight-square-guide-title" className="mb-4 overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Circuit-aware mission support</p>
                        <h3 id="eight-square-guide-title" className="mt-1 text-sm font-semibold text-white">8 Square Guide</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setShowCircuitCheck(true); checkStep(activeLesson, nextStep.id) }} disabled={isStudent && Boolean(activeAssignment) && (!missionStarted || assignmentLocked)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-semibold text-slate-200 transition hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><Activity size={13} />Check live circuit</button>
                        {onOpenCopilot && <button type="button" onClick={onOpenCopilot} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 px-3 py-2 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-400/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Ask 8 Square</button>}
                        <button type="button" onClick={() => setHintLevels((current) => ({ ...current, [nextStepKey]: Math.min(3, (current[nextStepKey] || 0) + 1) }))} disabled={guideLevel >= 3} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/10 px-3 py-2 text-[10px] font-semibold text-cyan-200 transition hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><Lightbulb size={13} />{guideLevel === 0 ? "Get a hint" : guideLevel < 3 ? "Next hint" : "All hints shown"}</button>
                      </div>
                    </div>
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.8fr)]">
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-500">Next checkpoint · {nextStep.kind}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-100">{cleanDisplayText(nextStep.title)}</p>
                        <p className="mt-1.5 text-[11px] leading-5 text-slate-400">{cleanDisplayText(nextStep.instructions)}</p>
                        {nextStepResult && <div role="status" className={"mt-3 rounded-lg border px-3 py-2 text-[10px] " + (nextStepResult.passed ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200" : "border-amber-500/20 bg-amber-500/5 text-amber-200")}>{cleanDisplayText(nextStepResult.summary)}</div>}
                        {guideLevel > 0 && <div className="mt-3 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-wide text-cyan-300">Hint {guideLevel} of 3</p><p className="mt-1 text-[11px] leading-5 text-slate-300">{missionHint(activeLesson, nextStep, guideLevel, nextStepResult)}</p></div>}
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Circuit check</p>
                          <span className={"rounded-full px-2 py-1 text-[9px] font-semibold " + (circuitReport.status === "healthy" ? "bg-emerald-500/10 text-emerald-300" : circuitReport.status === "danger" ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300")}>{circuitReport.status === "healthy" ? "No known issue" : circuitReport.status === "danger" ? "Safety issue" : "Needs attention"}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">Model checks: {circuitReport.criticalCount} critical, {circuitReport.warningCount} warnings, {circuitReport.tipCount} notes.</p>
                        {showCircuitCheck && <div className="mt-3 space-y-2">
                          {circuitReport.issues.length === 0 ? <p className="text-[10px] leading-4 text-emerald-300">No known wiring or safety issue was detected by the current checks. This does not prove physical hardware is safe.</p> : circuitReport.issues.slice(0, 3).map((issue) => (
                            <div key={issue.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                              <p className="text-[10px] font-semibold text-slate-200">{cleanDisplayText(issue.title)}</p>
                              <p className="mt-1 text-[10px] leading-4 text-slate-400">{cleanDisplayText(issue.message)}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {issue.involvedPartIds.length > 0 && <button type="button" onClick={() => onHighlightParts?.(issue.involvedPartIds)} className="text-[9px] font-semibold text-cyan-300 underline-offset-2 hover:underline">Focus related parts</button>}
                                {issue.id.startsWith("led-rev-pol-") && copilotAction && <button type="button" onClick={() => stagePolarityCorrection(issue.involvedPartIds[0])} className="text-[9px] font-semibold text-cyan-300 underline-offset-2 hover:underline"><Wrench size={11} className="mr-1 inline" />Preview polarity fix</button>}
                              </div>
                            </div>
                          ))}
                          {copilotAction?.stagedPreview?.proposal.title === "Correct LED polarity" && <button type="button" onClick={applyStagedGuideFix} className="w-full rounded-lg bg-cyan-400 px-3 py-2 text-[10px] font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Apply reviewed polarity fix</button>}
                        </div>}
                      </div>
                    </div>
                    <div className="border-t border-slate-800 px-4 py-3">
                      <div className="flex items-center gap-2"><ShieldCheck size={13} className="text-slate-500" /><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Live simulator evidence</p></div>
                      {liveEvidence.length === 0 ? <p className="mt-1 text-[10px] text-slate-500">Run the circuit or add a supported sensor to see model readings here.</p> : <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {liveEvidence.slice(0, 6).map((item) => <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"><div className="flex items-baseline justify-between gap-2"><span className="text-[10px] text-slate-400">{item.label}</span><span className="font-mono text-[11px] text-slate-200">{item.value}</span></div><p className="mt-1 text-[9px] leading-4 text-slate-600">{item.note}</p></div>)}
                      </div>}
                      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/35">
                        <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">Known-answer reference cases</summary>
                        <div className="grid gap-2 border-t border-slate-800 p-3 md:grid-cols-2">
                          {MODEL_REFERENCE_CASES.map((item) => <article key={item.id} className="rounded-lg bg-slate-900/80 p-3"><h4 className="text-[10px] font-semibold text-slate-200">{item.title}</h4><p className="mt-1 text-[9px] leading-4 text-slate-500">{item.setup}</p><p className="mt-2 font-mono text-[9px] text-cyan-200">{item.equation}</p><p className="mt-1 text-[10px] text-slate-300">{item.expected}</p><p className="mt-1 text-[9px] leading-4 text-slate-600">{item.assumptions}</p></article>)}
                        </div>
                      </details>
                      <p className="mt-2 text-[9px] leading-4 text-slate-600">Reference values describe stated assumptions. Live readings come from the Virtual Lab model and Blockly runtime; they do not verify physical hardware, component tolerance, timing, or firmware compilation.</p>
                    </div>
                  </section>
                )}

                {isStudent && activeAssignment && (
                  <section aria-labelledby="assignment-result-title" className="mb-4 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Class assignment · {activeAssignment.class_name}</p><h3 id="assignment-result-title" className="mt-1 text-sm font-semibold text-white">{activeAssignment.title}</h3><p className="mt-1 text-[10px] text-slate-500">{activeAssignment.due_date ? "Due " + activeAssignment.due_date : "No due date set"}</p></div>
                      <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-300">{myAssignmentProgress?.status === "reviewed" ? "Reviewed" : myAssignmentProgress?.status === "submitted" ? "Submitted" : "In progress"}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><Cloud size={13} className={cloudState === "saved" ? "text-emerald-300" : cloudState === "error" ? "text-amber-300" : "text-slate-500"} />{cloudState === "saving" ? "Saving to your class workspace…" : cloudState === "saved" ? "Progress synced to your class workspace" : cloudState === "error" ? "Class sync needs attention" : "Progress sync starts when you begin this mission"}</div>
                    {!assignmentLocked && <div className="mt-3">
                      <label htmlFor="mission-reflection" className="text-[10px] font-medium text-slate-400">Reflection · what evidence helped you reach the result?</label>
                      <textarea id="mission-reflection" value={reflection} onChange={(event) => setReflection(event.target.value.slice(0, 1000))} rows={2} maxLength={1000} className="mt-1.5 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] leading-5 text-slate-200 placeholder:text-slate-600 focus:border-cyan-400/60 focus:outline-none" placeholder="Describe one observation from your circuit or program." />
                    </div>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500">Result card: {activeProgress?.completedStepIds.length || 0} / {activeLesson.steps.length} checkpoints complete</p>
                      {myAssignmentProgress?.status === "reviewed" ? <p className="text-[10px] leading-4 text-emerald-200">{myAssignmentProgress.feedback || "Your teacher reviewed this mission."}</p> : myAssignmentProgress?.status === "submitted" ? <p className="text-[10px] text-slate-400">Your work is with the teacher for review.</p> : <button type="button" onClick={submitActiveMission} disabled={submissionSaving || activePercent < 100} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-[10px] font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><Send size={12} />{submissionSaving ? "Submitting…" : activePercent < 100 ? "Complete all steps to submit" : "Submit result to teacher"}</button>}
                    </div>
                  </section>
                )}

                {canManageAssignments && activeLesson && (
                  <section className="mb-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
                    <button type="button" aria-expanded={teacherToolsOpen} onClick={() => setTeacherToolsOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"><span><span className="block text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Teacher workspace</span><span className="mt-1 block text-xs font-semibold text-slate-200">Manage assignments and results</span></span><span className="text-[10px] text-cyan-300">{teacherToolsOpen ? "Close" : "Open"}</span></button>
                    {teacherToolsOpen && <div className="space-y-4 border-t border-slate-800 p-4">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                        <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Class
                          <select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] normal-case text-slate-200">
                            <option value="">Choose a class</option>
                            {classes.map((item) => <option key={item.id} value={item.id}>{item.display_name || [item.grade, item.section].filter(Boolean).join(" ") || item.id}</option>)}
                          </select>
                        </label>
                        <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Due date
                          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] normal-case text-slate-200" />
                        </label>
                        <button type="button" onClick={assignActiveMission} disabled={!selectedClassId || assignmentSaving} className="self-end rounded-lg bg-cyan-400 px-3 py-2 text-[10px] font-semibold text-slate-950 disabled:opacity-40">{assignmentSaving ? "Assigning…" : "Assign mission"}</button>
                      </div>
                      {classes.length === 0 && <p className="text-[10px] text-slate-500">No classes are available in your account scope.</p>}
                      {reviewItems.length > 0 && <div className="space-y-2 border-t border-slate-800 pt-3"><div className="flex items-center justify-between gap-2"><p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">Student results</p><button type="button" onClick={() => refreshAssignments().catch((error) => setCloudError(error instanceof Error ? error.message : "Could not refresh results."))} className="text-[9px] font-medium text-cyan-300 hover:underline">Refresh</button></div>
                        {reviewItems.map((item) => <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-[11px] font-semibold text-slate-200">{item.student?.name || "Student"}{item.student?.roll_number ? " · Roll " + item.student.roll_number : ""}</h4><p className="mt-1 text-[9px] text-slate-500">{item.assignmentTitle} · {item.result_summary?.completed_steps || 0} / {item.result_summary?.total_steps || 0} checkpoints</p></div><span className="text-[9px] uppercase tracking-wide text-cyan-300">{item.status}</span></div>
                          {item.reflection && <p className="mt-2 text-[10px] leading-4 text-slate-400">Student reflection: {item.reflection}</p>}
                          {item.feedback && <p className="mt-2 text-[10px] leading-4 text-emerald-200">Teacher feedback: {item.feedback}</p>}
                          {item.status === "submitted" && canReviewAssignments && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><textarea aria-label={"Feedback for " + (item.student?.name || "student")} value={reviewFeedback[item.id] || ""} onChange={(event) => setReviewFeedback((current) => ({ ...current, [item.id]: event.target.value.slice(0, 1000) }))} rows={2} maxLength={1000} placeholder="Add a concise note for the learner" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-200 placeholder:text-slate-600" /><button type="button" onClick={() => reviewSubmission(item.assignmentId, item.id)} disabled={reviewSavingId === item.id} className="self-end rounded-lg border border-cyan-400/30 px-3 py-2 text-[10px] font-semibold text-cyan-200 disabled:opacity-40">{reviewSavingId === item.id ? "Saving…" : "Mark reviewed"}</button></div>}
                        </article>)}
                      </div>}
                    </div>}
                  </section>
                )}
                {cloudError && (isStudent || canManageAssignments) && <p role="status" className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200">{cloudError}</p>}

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
                                disabled={locked || done || (isStudent && Boolean(activeAssignment) && (!missionStarted || assignmentLocked))}
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
            <span>Progress is scoped to this account; assigned missions sync to the class workspace.</span>
          </div>
        </section>
      </div>
    </div>
  )
}
