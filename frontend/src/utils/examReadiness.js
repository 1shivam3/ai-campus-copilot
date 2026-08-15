export function calculateExamReadiness({
  topics = [],
  daysRemaining = 7,
}) {
  if (!topics.length) {
    return {
      score: 0,
      label: "No syllabus data",
    }
  }

  const averageMastery =
    topics.reduce(
      (sum, topic) =>
        sum + Number(topic.mastery_score || 0),
      0
    ) / topics.length

  const masteryScore = Math.round(averageMastery)

  let urgencyPenalty = 0

  if (daysRemaining <= 1) {
    urgencyPenalty = 25
  } else if (daysRemaining <= 3) {
    urgencyPenalty = 15
  } else if (daysRemaining <= 7) {
    urgencyPenalty = 5
  }

  const score = Math.max(
    0,
    Math.min(100, masteryScore - urgencyPenalty)
  )

  let label = "Needs attention"

  if (score >= 80) {
    label = "Strong"
  } else if (score >= 60) {
    label = "On track"
  } else if (score >= 40) {
    label = "At risk"
  }

  return {
    score,
    label,
    averageMastery: masteryScore,
  }
}
