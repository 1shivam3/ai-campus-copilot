/**
 * CoursePilot Verifiable Badges Engine
 * Defines standard badges and evaluates user progress against badge unlocking criteria.
 */

import { supabase } from "../lib/supabase"

export const BADGE_DEFINITIONS = [
  {
    key: "first_challenge",
    name: "First Step",
    icon: "🎯",
    description: "Solved your first daily educational challenge.",
    category: "Challenges",
  },
  {
    key: "dsa_solver",
    name: "DSA Solver",
    icon: "💻",
    description: "Completed 3 or more algorithmic DSA challenges.",
    category: "Challenges",
  },
  {
    key: "first_quiz",
    name: "Knowledge Check",
    icon: "📝",
    description: "Completed your first topic or exam revision quiz.",
    category: "Academic",
  },
  {
    key: "quiz_master",
    name: "Quiz Master",
    icon: "🧠",
    description: "Scored 90%+ on 3 or more curriculum quizzes.",
    category: "Academic",
  },
  {
    key: "seven_day_streak",
    name: "7-Day Streak",
    icon: "🔥",
    description: "Maintained a continuous 7-day academic study streak.",
    category: "Consistency",
  },
  {
    key: "thirty_day_streak",
    name: "30-Day Master",
    icon: "⚡",
    description: "Maintained a continuous 30-day learning streak.",
    category: "Consistency",
  },
  {
    key: "project_builder",
    name: "Project Builder",
    icon: "🚀",
    description: "Completed a systems architecture micro-project.",
    category: "Projects",
  },
  {
    key: "helpful_reviewer",
    name: "Helpful Reviewer",
    icon: "🤝",
    description: "Contributed a verified explanation or peer feedback.",
    category: "Community",
  },
  {
    key: "learning_path_complete",
    name: "Syllabus Champion",
    icon: "🎓",
    description: "Mastered all topics in an active syllabus module.",
    category: "Syllabus",
  },
  {
    key: "exam_ready",
    name: "Exam Ready",
    icon: "🛡️",
    description: "Achieved 'Strong' readiness status for an upcoming exam.",
    category: "Exams",
  },
]

/**
 * Fetch unlocked badges from Supabase or local cache.
 */
export async function getUserBadges(userId) {
  if (!userId) return []

  try {
    const { data, error } = await supabase
      .from("user_badges")
      .select("*")
      .eq("user_id", userId)

    if (error || !data) {
      return getCachedUserBadges(userId)
    }

    setCachedUserBadges(userId, data)
    return data
  } catch {
    return getCachedUserBadges(userId)
  }
}

/**
 * Evaluate all badge conditions and award any newly unlocked badges.
 */
export async function evaluateAndAwardBadges({
  userId,
  xpTransactions = [],
  quizAttempts = [],
  currentStreak = 0,
  topicProgress = [],
  examReadiness = null,
}) {
  if (!userId) return []

  const existingBadges = await getUserBadges(userId)
  const existingKeys = new Set(existingBadges.map((b) => b.badge_key))
  const newlyUnlocked = []

  // Count challenge types
  const challengeTxs = xpTransactions.filter((tx) =>
    tx.reference_type === "challenge" || tx.reference_key?.startsWith("challenge_completion")
  )
  const dsaTxs = challengeTxs.filter((tx) =>
    tx.reason?.toLowerCase().includes("dsa") || tx.reference_id?.includes("dsa")
  )
  const projectTxs = xpTransactions.filter((tx) =>
    tx.reference_type === "micro_project" || tx.reference_id?.includes("project")
  )
  const peerTxs = xpTransactions.filter((tx) =>
    tx.reference_type === "peer_review" || tx.reference_id?.includes("community")
  )

  // 1. first_challenge
  if (!existingKeys.has("first_challenge") && challengeTxs.length >= 1) {
    newlyUnlocked.push("first_challenge")
  }

  // 2. dsa_solver
  if (!existingKeys.has("dsa_solver") && dsaTxs.length >= 2) {
    newlyUnlocked.push("dsa_solver")
  }

  // 3. first_quiz
  if (!existingKeys.has("first_quiz") && quizAttempts.length >= 1) {
    newlyUnlocked.push("first_quiz")
  }

  // 4. quiz_master
  const highScoringQuizzes = quizAttempts.filter((q) => (q.score_percentage || 0) >= 90)
  if (!existingKeys.has("quiz_master") && highScoringQuizzes.length >= 3) {
    newlyUnlocked.push("quiz_master")
  }

  // 5. seven_day_streak
  if (!existingKeys.has("seven_day_streak") && currentStreak >= 7) {
    newlyUnlocked.push("seven_day_streak")
  }

  // 6. thirty_day_streak
  if (!existingKeys.has("thirty_day_streak") && currentStreak >= 30) {
    newlyUnlocked.push("thirty_day_streak")
  }

  // 7. project_builder
  if (!existingKeys.has("project_builder") && projectTxs.length >= 1) {
    newlyUnlocked.push("project_builder")
  }

  // 8. helpful_reviewer
  if (!existingKeys.has("helpful_reviewer") && peerTxs.length >= 1) {
    newlyUnlocked.push("helpful_reviewer")
  }

  // 9. learning_path_complete (Mastery >= 80% on 4+ topics)
  const masteredTopics = topicProgress.filter((tp) => (tp.mastery_score || 0) >= 80)
  if (!existingKeys.has("learning_path_complete") && masteredTopics.length >= 4) {
    newlyUnlocked.push("learning_path_complete")
  }

  // 10. exam_ready
  if (!existingKeys.has("exam_ready") && examReadiness?.label === "Strong") {
    newlyUnlocked.push("exam_ready")
  }

  // Award newly unlocked badges to Supabase
  for (const badgeKey of newlyUnlocked) {
    const def = BADGE_DEFINITIONS.find((b) => b.key === badgeKey)
    if (!def) continue

    const badgePayload = {
      user_id: userId,
      badge_key: def.key,
      badge_name: def.name,
      description: def.description,
      icon: def.icon,
      earned_at: new Date().toISOString(),
    }

    try {
      await supabase.from("user_badges").insert([badgePayload])
    } catch {}

    existingBadges.push(badgePayload)
  }

  setCachedUserBadges(userId, existingBadges)
  return existingBadges
}

// Local Cache Helpers
const LOCAL_BADGES_KEY = "coursepilot_user_badges_cache"

function getCachedUserBadges(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_BADGES_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setCachedUserBadges(userId, badges) {
  try {
    localStorage.setItem(`${LOCAL_BADGES_KEY}_${userId}`, JSON.stringify(badges))
  } catch {}
}
