/**
 * CoursePilot Verifiable Learning Streak Engine
 * Evaluates consecutive days with genuine academic activities:
 * - Study Sessions / Focus Sessions completed
 * - Topic / Exam Quizzes completed
 * - Challenges solved
 * - Tasks completed
 */

export function calculateLearningStreak({
  studySessions = [],
  quizAttempts = [],
  xpTransactions = [],
  tasks = [],
  profile = null,
}) {
  const activeDateSet = new Set()

  // Helper to extract YYYY-MM-DD
  const addDate = (dateStr) => {
    if (!dateStr) return
    try {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, "0")
        const dd = String(d.getDate()).padStart(2, "0")
        activeDateSet.add(`${yyyy}-${mm}-${dd}`)
      }
    } catch {}
  }

  // 1. Focus Sessions / Study Sessions
  studySessions.forEach((s) => addDate(s.completed_at || s.created_at))

  // 2. Quiz Attempts
  quizAttempts.forEach((q) => addDate(q.attempted_at || q.created_at))

  // 3. Challenge Completions & XP Transactions
  xpTransactions.forEach((tx) => addDate(tx.created_at))

  // 4. Completed Tasks
  tasks.filter((t) => t.is_completed).forEach((t) => addDate(t.completed_at || t.updated_at))

  // If no verifiable activity recorded yet, check profile baseline
  if (activeDateSet.size === 0) {
    const profileStreak = profile?.current_streak || 0
    return {
      currentStreak: profileStreak,
      longestStreak: Math.max(profileStreak, profile?.longest_streak || 0),
      hasActivityToday: false,
      lastActivityDate: profile?.last_activity_date || null,
      totalActiveDays: profileStreak > 0 ? profileStreak : 0,
    }
  }

  // Sort unique active dates in descending order
  const sortedDates = Array.from(activeDateSet).sort((a, b) => b.localeCompare(a))

  const today = new Date()
  const todayStr = formatDateStr(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDateStr(yesterday)

  const hasActivityToday = sortedDates.includes(todayStr)
  const hasActivityYesterday = sortedDates.includes(yesterdayStr)

  // Determine starting point for current streak
  let currentStreak = 0
  if (hasActivityToday || hasActivityYesterday) {
    let checkDate = hasActivityToday ? new Date(today) : new Date(yesterday)

    while (true) {
      const dateKey = formatDateStr(checkDate)
      if (sortedDates.includes(dateKey)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Calculate longest historical streak
  let longestStreak = 0
  let tempStreak = 0
  if (sortedDates.length > 0) {
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1
      } else {
        const prev = new Date(sortedDates[i - 1])
        const curr = new Date(sortedDates[i])
        const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          tempStreak++
        } else {
          longestStreak = Math.max(longestStreak, tempStreak)
          tempStreak = 1
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak)
    }
  }

  // Merge with profile baseline if profile had higher historical record
  const finalCurrentStreak = Math.max(currentStreak, hasActivityToday ? (profile?.current_streak || 0) : currentStreak)
  const finalLongestStreak = Math.max(longestStreak, profile?.longest_streak || 0, finalCurrentStreak)

  return {
    currentStreak: finalCurrentStreak,
    longestStreak: finalLongestStreak,
    hasActivityToday,
    lastActivityDate: sortedDates[0] || null,
    totalActiveDays: sortedDates.length,
  }
}

function formatDateStr(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}
