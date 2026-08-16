/**
 * Deterministic Feed Ranking Algorithm for CoursePilot
 * Ranks educational content based on academic state, weak topics, exam urgency, and novelty.
 * 
 * Weights:
 * - Academic Relevance:    30%
 * - Weak Topic Relevance:  25%
 * - Exam Urgency:          15%
 * - Career Relevance:      10%
 * - Novelty:               10%
 * - Difficulty Fit:         5%
 * - Social Relevance:       5%
 */

export function rankFeedItems({
  feedItems = [],
  profile = null,
  topicProgress = [],
  exams = [],
  completedReferenceKeys = new Set(),
  activeTab = "For You"
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
  const urgentExamSubjects = new Map() // subject_name -> days_remaining
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
  const scoredItems = filteredItems.map((item) => {
    let academicScore = 70 // default standard academic relevance
    let weakTopicScore = 0
    let examUrgencyScore = 0
    let careerScore = 50
    let noveltyScore = 100
    let difficultyFitScore = 75
    let socialScore = 30

    const itemTopic = (item.topic || "").toLowerCase()
    const itemSubject = (item.subject || "").toLowerCase()

    // A. Academic Relevance (Matches Semester 3 Subjects: DSA, DBMS, OS, Java, Math)
    if (
      itemSubject.includes("data structure") ||
      itemSubject.includes("algorithm") ||
      itemSubject.includes("database") ||
      itemSubject.includes("operating") ||
      itemSubject.includes("python") ||
      itemSubject.includes("software")
    ) {
      academicScore = 100
    }

    // B. Weak Topic Relevance (Matches low-mastery topics)
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

    // C. Exam Urgency (Upcoming exam within 14 days)
    for (const [subj, days] of urgentExamSubjects.entries()) {
      if (itemSubject.includes(subj) || subj.includes(itemSubject)) {
        // Closer exam = higher score: 0-2 days -> 100, 3-7 days -> 80, 8-14 days -> 50
        if (days <= 2) examUrgencyScore = 100
        else if (days <= 7) examUrgencyScore = 80
        else examUrgencyScore = 50
        break
      }
    }

    // D. Career Relevance
    if (item.tags?.some((t) => ["DSA", "Architecture", "AI", "Performance"].includes(t))) {
      careerScore = 90
    }

    // E. Novelty & Completion Penalty
    const isCompleted = completedReferenceKeys.has(`challenge_completion:${item.id}`)
    if (isCompleted) {
      noveltyScore = 15 // deprioritize completed items
    } else {
      // Age decay (newer = higher novelty)
      const ageHours = (Date.now() - new Date(item.created_at || Date.now()).getTime()) / 3600000
      noveltyScore = Math.max(40, 100 - Math.min(60, ageHours * 1.5))
    }

    // F. Difficulty Fit
    if (item.difficulty === "Easy") difficultyFitScore = 80
    else if (item.difficulty === "Medium") difficultyFitScore = 95
    else if (item.difficulty === "Hard") difficultyFitScore = 70

    // G. Social Relevance
    if (item.category === "Community" || item.type.includes("peer")) {
      socialScore = 95
    }

    // Weighted Total Score (0 - 100)
    const finalScore = Math.round(
      academicScore * 0.30 +
      weakTopicScore * 0.25 +
      examUrgencyScore * 0.15 +
      careerScore * 0.10 +
      noveltyScore * 0.10 +
      difficultyFitScore * 0.05 +
      socialScore * 0.05
    )

    return {
      ...item,
      rankingScore: finalScore,
      isCompleted,
      scoreBreakdown: {
        academicScore,
        weakTopicScore,
        examUrgencyScore,
        careerScore,
        noveltyScore,
        difficultyFitScore,
        socialScore,
      },
    }
  })

  // Sort descending by score, prioritizing uncompleted high-yield items
  return scoredItems.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1 // Uncompleted items first
    }
    return b.rankingScore - a.rankingScore
  })
}
