/**
 * CoursePilot Adaptive Difficulty Engine
 * Dynamically determines target question difficulty based on historical challenge performance.
 * 
 * Rules:
 * - Accuracy >= 80% with 3+ attempts at current level -> Promote to next difficulty.
 * - Accuracy < 40% with 3+ attempts at current level -> Demote to previous difficulty.
 * - Otherwise -> Maintain current level (default: "Medium").
 */

export function calculateAdaptiveDifficulty(challengeHistory = []) {
  if (!Array.isArray(challengeHistory) || challengeHistory.length === 0) {
    return {
      currentLevel: "Medium",
      successRate: 0,
      totalAttempted: 0,
      totalPassed: 0,
      streakAtLevel: 0,
    }
  }

  const totalAttempted = challengeHistory.length
  const totalPassed = challengeHistory.filter((h) => h.passed || h.status === "passed").length
  const overallSuccessRate = Math.round((totalPassed / totalAttempted) * 100)

  // Look at the last 5 attempts for rapid adaptability
  const recent = challengeHistory.slice(-5)
  const recentPassed = recent.filter((h) => h.passed || h.status === "passed").length
  const recentRate = Math.round((recentPassed / recent.length) * 100)

  let currentLevel = "Medium"

  if (recent.length >= 3) {
    if (recentRate >= 80) {
      currentLevel = "Hard"
    } else if (recentRate <= 40) {
      currentLevel = "Easy"
    } else {
      currentLevel = "Medium"
    }
  } else {
    // Default fallback based on overall success
    if (overallSuccessRate >= 80) currentLevel = "Hard"
    else if (overallSuccessRate <= 40) currentLevel = "Easy"
    else currentLevel = "Medium"
  }

  return {
    currentLevel,
    successRate: overallSuccessRate,
    recentSuccessRate: recentRate,
    totalAttempted,
    totalPassed,
  }
}
