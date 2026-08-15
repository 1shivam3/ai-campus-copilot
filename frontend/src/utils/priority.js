export function calculatePriority(task) {
  if (!task || task.status === "completed") {
    return 0
  }

  const now = Date.now()
  const deadlineTime = task.deadline ? new Date(task.deadline).getTime() : now + 86400000 * 7

  const hoursRemaining = (deadlineTime - now) / (1000 * 60 * 60)

  let urgency = 3

  if (hoursRemaining <= 0) {
    urgency = 10 // Overdue gets maximum urgency
  } else if (hoursRemaining <= 12) {
    urgency = 10
  } else if (hoursRemaining <= 24) {
    urgency = 9
  } else if (hoursRemaining <= 48) {
    urgency = 7
  } else if (hoursRemaining <= 96) {
    urgency = 5
  }

  const importance = Math.max(1, Math.min(10, Number(task.importance || 5)))
  const effort = Math.min(
    10,
    Math.max(1, Number(task.estimated_minutes || 30) / 30)
  )

  const score =
    urgency * 0.45 +
    importance * 0.35 +
    effort * 0.20

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10))
}

export function getPriorityLabel(score) {
  const num = Number(score || 0)
  if (num >= 8) return "High"
  if (num >= 6) return "Medium"
  return "Low"
}
