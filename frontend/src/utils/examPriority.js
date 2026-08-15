export function calculateExamUrgency(exam) {
  if (!exam?.exam_date) return 0

  const diffTime = new Date(exam.exam_date).getTime() - new Date().getTime()
  const days = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  const importance = Number(exam.importance || 5)

  let daysScore = 1
  if (days <= 1) daysScore = 10
  else if (days <= 3) daysScore = 8
  else if (days <= 7) daysScore = 6
  else if (days <= 14) daysScore = 4
  else daysScore = 2

  return Math.round((daysScore * 0.6 + importance * 0.4) * 10) / 10
}

export function rankExamTopics(topics = []) {
  return [...topics]
    .map((topic) => {
      const mastery = Number(
        topic.mastery_score || 0
      )

      return {
        ...topic,
        riskScore: 100 - mastery,
      }
    })
    .sort(
      (a, b) =>
        b.riskScore - a.riskScore
    )
}

export function getTopExamRisks(
  topics = [],
  limit = 5
) {
  return rankExamTopics(topics).slice(0, limit)
}
