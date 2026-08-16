/**
 * CoursePilot Daily Challenge & Anti-Repeat Engine
 * Manages daily 5-question sets, anti-repeat filtering, adaptive difficulty matching,
 * completion bonuses (+50 XP), and bonus challenge mode (+5 extra questions).
 */

import { supabase } from "../lib/supabase"
import { FEED_CATALOG } from "../data/feedCatalog"
import { calculateAdaptiveDifficulty } from "./adaptiveDifficulty"
import { awardXP } from "./xpEngine"

const LOCAL_CHALLENGE_HISTORY_KEY = "coursepilot_challenge_history"
const DAILY_SET_COUNT = 5
const BONUS_SET_COUNT = 5
const DAILY_BONUS_XP = 50
const DAILY_BONUS_XP_CAP = 100

/**
 * Fetch all attempted/completed challenge records for the student.
 */
export async function getUserChallengeHistory(userId) {
  if (!userId) return getCachedChallengeHistory()

  try {
    const { data, error } = await supabase
      .from("user_challenge_history")
      .select("*")
      .eq("user_id", userId)

    if (!error && data) {
      setCachedChallengeHistory(data)
      return data
    }
  } catch {}

  return getCachedChallengeHistory()
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

  const history = getCachedChallengeHistory()
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
  setCachedChallengeHistory(history)

  try {
    await supabase.from("user_challenge_history").upsert(record, {
      onConflict: "user_id,challenge_id",
    })
  } catch {}

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
    // If pool exhausted, fallback to items not yet solved
    unattempted = FEED_CATALOG.filter((c) => !solvedIds.has(c.id))
  }
  if (unattempted.length === 0) {
    unattempted = [...FEED_CATALOG]
  }

  // 2. Sort by difficulty fit & interaction type diversity
  const prioritized = [...unattempted].sort((a, b) => {
    // Exact difficulty match preferred
    const aDiffMatch = a.difficulty === adaptive.currentLevel ? 1 : 0
    const bDiffMatch = b.difficulty === adaptive.currentLevel ? 1 : 0
    return bDiffMatch - aDiffMatch
  })

  // 3. Pick diverse set across categories
  const picked = []
  const usedTypes = new Set()

  for (const item of prioritized) {
    if (picked.length >= (isBonusMode ? BONUS_SET_COUNT : DAILY_SET_COUNT)) break
    if (!usedTypes.has(item.type) || picked.length >= 4) {
      picked.push({
        ...item,
        isCompleted: solvedIds.has(item.id),
      })
      usedTypes.add(item.type)
    }
  }

  // Backfill if needed
  for (const item of prioritized) {
    if (picked.length >= (isBonusMode ? BONUS_SET_COUNT : DAILY_SET_COUNT)) break
    if (!picked.some((p) => p.id === item.id)) {
      picked.push({
        ...item,
        isCompleted: solvedIds.has(item.id),
      })
    }
  }

  const completedCount = picked.filter((p) => p.isCompleted).length
  const isSetComplete = completedCount === picked.length && picked.length > 0

  return {
    challenges: picked,
    totalCount: picked.length,
    completedCount,
    isSetComplete,
    adaptiveLevel: adaptive.currentLevel,
    successRate: adaptive.successRate,
  }
}

/**
 * Check and award Daily Set Completion Bonus (+50 XP) idempotently.
 */
export async function awardDailySetBonus(userId) {
  if (!userId) return { awarded: false }

  const todayStr = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  const bonusRefKey = `daily_set_bonus:${todayStr}`

  const result = await awardXP({
    userId,
    amount: DAILY_BONUS_XP,
    reason: `Completed Today's 5 Daily Challenges (${todayStr})`,
    referenceType: "daily_completion_bonus",
    referenceId: todayStr,
  })

  return {
    awarded: !result.alreadyAwarded,
    amount: DAILY_BONUS_XP,
    alreadyAwarded: result.alreadyAwarded,
  }
}

// Local Storage Cache Helpers
function getCachedChallengeHistory() {
  try {
    const raw = localStorage.getItem(LOCAL_CHALLENGE_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setCachedChallengeHistory(history) {
  try {
    localStorage.setItem(LOCAL_CHALLENGE_HISTORY_KEY, JSON.stringify(history))
  } catch {}
}
