/**
 * CoursePilot XP & Points Engine
 * Handles verifiable XP awards, transaction logging, idempotency checks, and weekly XP aggregation.
 */

import { supabase } from "../lib/supabase"
import { syncUserLearningStats, fetchUserStats } from "../lib/api"

const LOCAL_XP_CACHE_KEY = "coursepilot_xp_transactions_cache"

// Standard XP Reward Scale
export const XP_REWARDS = {
  QUICK_CHALLENGE: 10,
  DSA_CHALLENGE: 25,
  QUIZ_COMPLETE: 20,
  PERFECT_QUIZ: 30,
  MICRO_PROJECT: 50,
  PEER_REVIEW: 15,
  LEARNING_PATH_COMPLETE: 40,
  DAILY_PLAN_COMPLETE: 25,
  SEVEN_DAY_STREAK: 50,
}

/**
 * Get all XP transactions for the authenticated student across all devices.
 */
export async function getXPTransactions(userId) {
  if (!userId) return []

  const cached = getCachedXPTransactions(userId)
  if (cached && cached.length > 0) {
    return cached
  }

  try {
    const { data, error } = await supabase
      .from("xp_transactions")
      .select("id, amount, reason, reference_key, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data && data.length > 0) {
      setCachedXPTransactions(userId, data)
      return data
    }
  } catch {}

  // Fallback to cloud backend store if not yet cached
  try {
    const cloudStats = await fetchUserStats(userId)
    if (cloudStats?.xp_transactions && cloudStats.xp_transactions.length > 0) {
      setCachedXPTransactions(userId, cloudStats.xp_transactions)
      return cloudStats.xp_transactions
    }
  } catch {}

  return cached || []
}

/**
 * Calculate total XP and this week's XP from transaction list.
 */
export function calculateXPSummary(transactions = []) {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { totalXP: 0, thisWeekXP: 0, completedKeys: new Set() }
  }

  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  let totalXP = 0
  let thisWeekXP = 0
  const completedKeys = new Set()

  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0
    totalXP += amount

    const txDate = new Date(tx.created_at || now)
    if (txDate >= oneWeekAgo) {
      thisWeekXP += amount
    }

    if (tx.reference_key) {
      completedKeys.add(tx.reference_key)
    }
  })

  return {
    totalXP,
    thisWeekXP,
    completedKeys,
  }
}

/**
 * Award XP to a student with idempotency protection.
 * Returns { success: boolean, alreadyAwarded: boolean, amount: number, transaction: object }
 */
export async function awardXP({
  userId,
  amount,
  reason,
  referenceType = "challenge",
  referenceId,
}) {
  if (!userId || !amount || amount <= 0) {
    return { success: false, error: "Invalid user or amount" }
  }

  // Idempotency reference key: e.g. "challenge_completion:dsa-1"
  const referenceKey = `${referenceType}_completion:${referenceId}`

  // Check local cache first for instant idempotency protection
  const cached = getCachedXPTransactions(userId)
  const existing = cached.find((tx) => tx.reference_key === referenceKey)
  if (existing) {
    return {
      success: true,
      alreadyAwarded: true,
      amount: existing.amount,
      transaction: existing,
    }
  }

  const newTx = {
    user_id: userId,
    amount: Math.min(amount, 500), // security clamp
    reason,
    reference_type: referenceType,
    reference_id: String(referenceId),
    reference_key: referenceKey,
    created_at: new Date().toISOString(),
  }

  try {
    const { data, error } = await supabase
      .from("xp_transactions")
      .insert([newTx])
      .select()
      .single()

    if (error) {
      // Check if duplicate key violation (code 23505)
      if (error.code === "23505") {
        return { success: true, alreadyAwarded: true, amount, transaction: newTx }
      }
      console.warn("Could not insert XP to Supabase, saving to local cache:", error)
    }

    const savedTx = data || newTx
    const updatedCache = [savedTx, ...cached.filter((t) => t.reference_key !== referenceKey)]
    setCachedXPTransactions(userId, updatedCache)

    const summary = calculateXPSummary(updatedCache)
    syncUserLearningStats({
      user_id: userId,
      total_xp: summary.totalXP,
      this_week_xp: summary.thisWeekXP,
      xp_transactions: updatedCache,
    }).catch(() => {})

    return {
      success: true,
      alreadyAwarded: false,
      amount,
      transaction: savedTx,
    }
  } catch (err) {
    console.warn("XP award error, cached locally:", err)
    const updatedCache = [newTx, ...cached.filter((t) => t.reference_key !== referenceKey)]
    setCachedXPTransactions(userId, updatedCache)

    const summary = calculateXPSummary(updatedCache)
    syncUserLearningStats({
      user_id: userId,
      total_xp: summary.totalXP,
      this_week_xp: summary.thisWeekXP,
      xp_transactions: updatedCache,
    }).catch(() => {})

    return {
      success: true,
      alreadyAwarded: false,
      amount,
      transaction: newTx,
    }
  }
}

// Local Storage Cache Helpers
function getCachedXPTransactions(userId) {
  try {
    const raw = localStorage.getItem(`${LOCAL_XP_CACHE_KEY}_${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setCachedXPTransactions(userId, transactions) {
  try {
    localStorage.setItem(
      `${LOCAL_XP_CACHE_KEY}_${userId}`,
      JSON.stringify(transactions)
    )
  } catch {}
}

export function clearUserXPCache(userId) {
  if (!userId) return
  try {
    localStorage.removeItem(`${LOCAL_XP_CACHE_KEY}_${userId}`)
  } catch {}
}
