import { calculatePriority } from "./priority"

export function getNextBestTask(tasks) {
  const pendingTasks = tasks.filter(
    (task) => task.status !== "completed"
  )

  if (pendingTasks.length === 0) {
    return null
  }

  return [...pendingTasks].sort(
    (a, b) => calculatePriority(b) - calculatePriority(a)
  )[0]
}
