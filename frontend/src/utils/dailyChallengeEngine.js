/**
 * CoursePilot Daily Challenge & Anti-Repeat Engine
 * Manages daily 5-question sets, anti-repeat filtering, adaptive difficulty matching,
 * completion bonuses (+50 XP), and bonus challenge mode (+5 extra questions).
 */

import { supabase } from "../lib/supabase"
import { syncUserLearningStats, fetchUserStats } from "../lib/api"
import { FEED_CATALOG } from "../data/feedCatalog"
import { calculateAdaptiveDifficulty } from "./adaptiveDifficulty"
import { awardXP } from "./xpEngine"

const LOCAL_CHALLENGE_HISTORY_KEY = "coursepilot_challenge_history"
const DAILY_SET_COUNT = 5
const BONUS_SET_COUNT = 5
const DAILY_BONUS_XP = 50
const DAILY_BONUS_XP_CAP = 100

/**
 * Fetch all attempted/completed challenge records for the student across all devices.
 */
export async function getUserChallengeHistory(userId) {
  if (!userId) return []

  const cached = getCachedChallengeHistory(userId)
  if (cached && cached.length > 0) {
    return cached
  }

  try {
    const { data, error } = await supabase
      .from("user_challenge_history")
      .select("challenge_id, passed, attempted_at")
      .eq("user_id", userId)
      .limit(100)

    if (!error && data && data.length > 0) {
      setCachedChallengeHistory(userId, data)
      return data
    }
  } catch {}

  // Fallback to cloud backend store if not yet cached
  try {
    const cloudStats = await fetchUserStats(userId)
    if (cloudStats?.challenge_history && cloudStats.challenge_history.length > 0) {
      setCachedChallengeHistory(userId, cloudStats.challenge_history)
      return cloudStats.challenge_history
    }
  } catch {}

  return cached || []
}

/**
 * Record a challenge attempt (passed or failed) for strict non-repetition.
 */
export async function recordChallengeAttempt({
  userId,
  challengeId,
  passed,
  score = 100,
  selectedOption = null,
}) {
  if (!userId || !challengeId) return { success: false }

  const history = getCachedChallengeHistory(userId)
  const existingIdx = history.findIndex((h) => h.challenge_id === challengeId)
  const record = {
    user_id: userId,
    challenge_id: challengeId,
    status: passed ? "passed" : "failed",
    score,
    passed,
    selected_option: selectedOption,
    attempted_at: new Date().toISOString(),
    completed_at: passed ? new Date().toISOString() : null,
  }

  if (existingIdx >= 0) {
    history[existingIdx] = { ...history[existingIdx], ...record }
  } else {
    history.push(record)
  }
  setCachedChallengeHistory(userId, history)

  try {
    await supabase.from("user_challenge_history").upsert(record, {
      onConflict: "user_id,challenge_id",
    })
  } catch {}

  // Sync to cloud backend store across devices
  syncUserLearningStats({
    user_id: userId,
    challenge_history: history,
  }).catch(() => {})

  return { success: true, record }
}

/**
 * Generate or retrieve Today's 5-Question Challenge Set.
 * Enforces strict anti-repeat filtering and interaction type diversity.
 */
export function getDailyChallengeSet({
  userId,
  challengeHistory = [],
  isBonusMode = false,
}) {
  const attemptedIds = new Set(challengeHistory.map((h) => h.challenge_id))
  const solvedIds = new Set(
    challengeHistory.filter((h) => h.passed || h.status === "passed").map((h) => h.challenge_id)
  )

  const adaptive = calculateAdaptiveDifficulty(challengeHistory)

  // 1. Filter out all already attempted challenges (Strict Non-Repetition)
  // For daily set, if student attempted everything, allow unpassed items or fallback
  let unattempted = FEED_CATALOG.filter((c) => !attemptedIds.has(c.id))
  if (unattempted.length < DAILY_SET_COUNT) {
    // If user attempted all catalog items, fall back to unsolved items
    unattempted = FEED_CATALOG.filter((c) => !solvedIds.has(c.id))
    if (unattempted.length < DAILY_SET_COUNT) {
      unattempted = FEED_CATALOG
    }
  }

  // 2. Select challenges matching user's adaptive difficulty and diverse categories
  const matched = unattempted.filter(
    (c) => c.difficulty?.toLowerCase() === adaptive.difficultyLevel.toLowerCase()
  )
  const pool = matched.length >= DAILY_SET_COUNT ? matched : unattempted

  // Ensure category diversity: 1 DSA, 1 Concept, 1 Quick, 1 Debug, 1 Project/Other
  const selected = []
  const usedIds = new Set()

  const categories = ["dsa", "concept", "quick", "debug", "math"]
  categories.forEach((cat) => {
    const item = pool.find(
      (c) => !usedIds.has(c.id) && c.category?.toLowerCase() === cat.toLowerCase()
    )
    if (item) {
      selected.push(item)
      usedIds.add(item.id)
    }
  })

  // Fill remaining slots up to DAILY_SET_COUNT (or BONUS_SET_COUNT if bonus mode)
  const targetCount = isBonusMode ? DAILY_SET_COUNT + BONUS_SET_COUNT : DAILY_SET_COUNT
  for (const item of pool) {
    if (selected.length >= targetCount) break
    if (!usedIds.has(item.id)) {
      selected.push(item)
      usedIds.add(item.id)
    }
  }

  // Count how many from current set are completed
  const completedInSet = selected.filter((c) => solvedIds.has(c.id)).length
  const isSetComplete = completedInSet >= DAILY_SET_COUNT

  return {
    challenges: selected,
    completedCount: completedInSet,
    totalCount: selected.length,
    isSetComplete,
    adaptiveLevel: adaptive.difficultyLevel,
    isBonusMode,
  }
}

/**
 * Award Daily Set Completion Bonus (+50 XP) once per UTC calendar day.
 */
export async function awardDailySetBonus(userId) {
  if (!userId) return { awarded: false, amount: 0 }

  const todayStr = new Date().toISOString().slice(0, 10)
  const bonusKey = `daily_set_bonus_${todayStr}`

  const result = await awardXP({
    userId,
    amount: DAILY_BONUS_XP,
    reason: `Daily Challenge Set Completion (${todayStr})`,
    referenceType: "daily_completion_bonus",
    referenceId: todayStr,
  })

  return {
    awarded: !result.alreadyAwarded,
    amount: DAILY_BONUS_XP,
    alreadyAwarded: result.alreadyAwarded,
  }
}

// Local Storage Cache Helpers (User-Scoped)
export function getCachedChallengeHistory(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(`${LOCAL_CHALLENGE_HISTORY_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setCachedChallengeHistory(userId, history) {
  if (!userId) return
  try {
    localStorage.setItem(`${LOCAL_CHALLENGE_HISTORY_KEY}_${userId}`, JSON.stringify(history))
  } catch {}
}

export function clearUserChallengeHistory(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(`${LOCAL_CHALLENGE_HISTORY_KEY}_${userId}`)
  } catch {}
}
