export function getWeakestTopic(topics, subject) {
  const subjectTopics = topics.filter(
    (topic) => topic.subject === subject
  )

  if (subjectTopics.length === 0) {
    return null
  }

  return [...subjectTopics].sort(
    (a, b) => a.mastery_score - b.mastery_score
  )[0]
}

export function getTopicRecommendation(exams, topics) {
  if (!exams.length) {
    return null
  }

  const sortedExams = [...exams].sort(
    (a, b) =>
      new Date(a.exam_date) - new Date(b.exam_date)
  )

  const mostUrgentExam = sortedExams[0]

  const weakestTopic = getWeakestTopic(
    topics,
    mostUrgentExam.subject
  )

  return {
    exam: mostUrgentExam,
    topic: weakestTopic,
  }
}
