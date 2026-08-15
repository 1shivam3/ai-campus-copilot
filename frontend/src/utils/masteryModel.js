export function calculateWeightedMastery(
  previousMastery,
  quizScore
) {
  const previous = Number(previousMastery || 0)
  const quiz = Number(quizScore || 0)

  const newMastery =
    previous * 0.7 + quiz * 0.3

  return Math.round(newMastery)
}

export function getMasteryStatus(score) {
  const mastery = Number(score || 0)

  if (mastery >= 80) {
    return "mastered"
  }

  if (mastery >= 40) {
    return "learning"
  }

  return "not_started"
}
