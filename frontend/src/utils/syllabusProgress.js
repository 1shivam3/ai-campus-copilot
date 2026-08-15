export function getWeakestSyllabusTopic(
  topics,
  progress
) {
  if (!topics?.length) {
    return null
  }

  const ranked = topics.map((topic) => {
    const current = progress?.[topic.id]

    return {
      ...topic,
      mastery_score: Number(
        current?.mastery_score || 0
      ),
      status:
        current?.status || "not_started",
    }
  })

  ranked.sort(
    (a, b) => a.mastery_score - b.mastery_score
  )

  return ranked[0] || null
}

export function calculateSyllabusMastery(
  topics,
  progress
) {
  if (!topics?.length) {
    return 0
  }

  const total = topics.reduce((sum, topic) => {
    return (
      sum +
      Number(
        progress?.[topic.id]?.mastery_score || 0
      )
    )
  }, 0)

  return Math.round(total / topics.length)
}
