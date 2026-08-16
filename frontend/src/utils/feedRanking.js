/**
 * Deterministic Feed Ranking Algorithm for CoursePilot
 * Multi-factor subject-balanced educational ranking:
 * 
 * Weights:
 * - Weak Topic Relevance:       25%
 * - Subject Diversity / Balance:20%
 * - Academic Syllabus Relevance:20%
 * - Exam Urgency:               10%
 * - Difficulty Fit:             10%
 * - Novelty:                    10%
 * - Social Relevance:            5%
 */

export function rankFeedItems({
  feedItems = [],
  profile = null,
  topicProgress = [],
  exams = [],
  completedReferenceKeys = new Set(),
  likedItemIds = new Set(),
  activeTab = "For You",
  targetDifficulty = "Medium",
}) {
  if (!Array.isArray(feedItems) || feedItems.length === 0) {
    return []
  }

  // 1. Identify weak topics (mastery < 60%)
  const weakTopicNames = new Set(
    topicProgress
      .filter((tp) => (tp.mastery_score || 0) < 60)
      .map((tp) => (tp.topic_name || "").toLowerCase())
  )

  // 2. Identify nearest exam subjects and remaining days
  const now = new Date()
  const urgentExamSubjects = new Map()
  exams.forEach((exam) => {
    if (!exam.exam_date) return
    const examDate = new Date(exam.exam_date)
    const diffDays = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays <= 14) {
      const subjectKey = (exam.subject || "").toLowerCase()
      const existing = urgentExamSubjects.get(subjectKey)
      if (existing === undefined || diffDays < existing) {
        urgentExamSubjects.set(subjectKey, diffDays)
      }
    }
  })

  // 3. Filter by category tab if not "For You"
  let filteredItems = [...feedItems]
  if (activeTab && activeTab !== "For You") {
    filteredItems = filteredItems.filter((item) => {
      if (activeTab === "Challenges") {
        return item.category === "Challenges" || item.type.includes("challenge")
      }
      if (activeTab === "Learn") {
        return item.category === "Learn" || item.type.includes("concept") || item.type.includes("syllabus")
      }
      if (activeTab === "Tech") {
        return item.category === "Tech" || item.type.includes("tech")
      }
      if (activeTab === "Community") {
        return item.category === "Community" || item.type.includes("peer") || item.type.includes("project")
      }
      return true
    })
  }

  // 4. Calculate deterministic multi-factor score for each item
  const subjectOccurrenceCount = new Map()

  const scoredItems = filteredItems.map((item) => {
    let weakTopicScore = 0
    let diversityScore = 80
    let academicScore = 80
    let examUrgencyScore = 0
    let difficultyFitScore = 70
    let noveltyScore = 100
    let socialScore = 0

    const itemTopic = (item.topic || "").toLowerCase()
    const itemSubject = (item.subject || "").toLowerCase()

    // A. Weak Topic Relevance (25%)
    for (const weakTopic of weakTopicNames) {
      if (itemTopic.includes(weakTopic) || weakTopic.includes(itemTopic)) {
        weakTopicScore = 100
        break
      }
    }
    if (weakTopicScore === 0 && item.tags) {
      for (const tag of item.tags) {
        if (weakTopicNames.has(tag.toLowerCase())) {
          weakTopicScore = 80
          break
        }
      }
    }

    // B. Subject Diversity Balancing (20%)
    const prevCount = subjectOccurrenceCount.get(itemSubject) || 0
    subjectOccurrenceCount.set(itemSubject, prevCount + 1)
    diversityScore = Math.max(20, 100 - prevCount * 25)

    // C. Academic Syllabus Relevance (20%)
    if (
      itemSubject.includes("data structure") ||
      itemSubject.includes("algorithm") ||
      itemSubject.includes("database") ||
      itemSubject.includes("operating") ||
      itemSubject.includes("software") ||
      itemSubject.includes("discrete") ||
      itemSubject.includes("generative ai") ||
      itemSubject.includes("python")
    ) {
      academicScore = 100
    }

    // D. Exam Urgency (10%)
    for (const [subj, days] of urgentExamSubjects.entries()) {
      if (itemSubject.includes(subj) || subj.includes(itemSubject)) {
        if (days <= 2) examUrgencyScore = 100
        else if (days <= 7) examUrgencyScore = 80
        else examUrgencyScore = 50
        break
      }
    }

    // E. Difficulty Fit (10%)
    if (item.difficulty === targetDifficulty) {
      difficultyFitScore = 100
    } else {
      difficultyFitScore = 60
    }

    // F. Novelty & Completion Penalty (10%)
    const isCompleted =
      completedReferenceKeys.has(`challenge_completion:${item.id}`) ||
      completedReferenceKeys.has(item.id)

    if (isCompleted) {
      noveltyScore = 10
    } else {
      const ageHours = (Date.now() - new Date(item.created_at || Date.now()).getTime()) / 3600000
      noveltyScore = Math.max(40, 100 - Math.min(60, ageHours * 1.5))
    }

    // G. Real Social Relevance (5%)
    const realLikes = (item.likes_count || 0) + (likedItemIds.has(item.id) ? 1 : 0)
    const realParticipation = item.participation_count || 0
    socialScore = Math.min(100, Math.round(realLikes * 10 + realParticipation * 5))

    // Weighted Total Score (0 - 100)
    const finalScore = Math.round(
      weakTopicScore * 0.25 +
      diversityScore * 0.20 +
      academicScore * 0.20 +
      examUrgencyScore * 0.10 +
      difficultyFitScore * 0.10 +
      noveltyScore * 0.10 +
      socialScore * 0.05
    )

    return {
      ...item,
      rankingScore: finalScore,
      isCompleted,
      likes_count: realLikes,
    }
  })

  // Sort descending by score, prioritizing uncompleted high-yield items
  return scoredItems.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1
    }
    return b.rankingScore - a.rankingScore
  })
}
