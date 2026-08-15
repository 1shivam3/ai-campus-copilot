export function calculateExamUrgency(exam) {
  const now = new Date()
  const examDate = new Date(exam.exam_date)

  const hoursRemaining = Math.max(
    1,
    (examDate - now) / (1000 * 60 * 60)
  )

  let urgency

  if (hoursRemaining <= 24) {
    urgency = 10
  } else if (hoursRemaining <= 48) {
    urgency = 9
  } else if (hoursRemaining <= 72) {
    urgency = 8
  } else if (hoursRemaining <= 7 * 24) {
    urgency = 6
  } else if (hoursRemaining <= 14 * 24) {
    urgency = 4
  } else {
    urgency = 2
  }

  const importance = Number(exam.importance || 5)

  return Math.round(
    (urgency * 0.7 + importance * 0.3) * 10
  ) / 10
}
