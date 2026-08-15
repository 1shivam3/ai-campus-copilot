import { calculatePriority } from "./priority"
import { calculateExamUrgency } from "./examPriority"

export function getAcademicRecommendation(tasks, exams) {
  const pendingTasks = tasks
    .filter((task) => task.status !== "completed")
    .map((task) => ({
      type: "task",
      item: task,
      score: calculatePriority(task),
    }))

  const upcomingExams = exams.map((exam) => ({
    type: "exam",
    item: exam,
    score: calculateExamUrgency(exam),
  }))

  const combined = [
    ...pendingTasks,
    ...upcomingExams,
  ]

  if (combined.length === 0) {
    return null
  }

  combined.sort((a, b) => b.score - a.score)

  return combined[0]
}
