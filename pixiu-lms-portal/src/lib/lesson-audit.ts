import { LESSONS } from "./lesson-engine"

/** Lightweight definition audit used during development and CI to catch empty lessons. */
export function auditLessonDefinitions() {
  return LESSONS.flatMap((lesson) => {
    const issues: string[] = []
    if (lesson.steps.length === 0) issues.push("has no steps")
    lesson.steps.forEach((step, index) => {
      if (!step.title.trim()) issues.push(`step ${index + 1} has no title`)
      if (!step.instructions.trim()) issues.push(`step ${index + 1} has no instructions`)
      if (step.checks.length === 0) issues.push(`step ${index + 1} has no checks`)
    })
    return issues.map((issue) => `${lesson.id}: ${issue}`)
  })
}
