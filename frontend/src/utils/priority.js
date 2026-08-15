export function calculatePriority(task) {
  if (task.status === "completed") {
    return 0
  }

  const now = new Date()
  const deadline = new Date(task.deadline)

  const hoursRemaining = Math.max(
    1,
    (deadline - now) / (1000 * 60 * 60)
  )

  let urgency

  if (hoursRemaining <= 12) {
    urgency = 10
  } else if (hoursRemaining <= 24) {
    urgency = 9
  } else if (hoursRemaining <= 48) {
    urgency = 7
  } else if (hoursRemaining <= 96) {
    urgency = 5
  } else {
    urgency = 3
  }

  const importance = Number(task.importance || 5)

  const effort = Math.min(
    10,
    Math.max(1, Number(task.estimated_minutes || 30) / 30)
  )

  const score =
    urgency * 0.45 +
    importance * 0.35 +
    effort * 0.20

  return Math.round(score * 10) / 10
}

export function getPriorityLabel(score) {
  if (score >= 8) return "High"
  if (score >= 6) return "Medium"
  return "Low"
}
