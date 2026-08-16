import { useState, useEffect, useMemo } from "react"
import { syncUserLearningStats, fetchCampusLeaderboard } from "../lib/api"
import { supabase } from "../lib/supabase"

const TIMEFRAMES = [
  { id: "global", label: "Global" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
]

export default function Leaderboard({
  user,
  profile,
  totalXP = 0,
  thisWeekXP = 0,
  streak = 0,
  reputation = 91,
  onNavigate,
}) {
  const [timeframe, setTimeframe] = useState("global")
  const [remoteRankings, setRemoteRankings] = useState(() => {
    try {
      const cached = localStorage.getItem("coursepilot_leaderboard_cache_global")
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)

  // Safe display name for current student
  const userDisplayName = useMemo(() => {
    if (profile?.public_display_name) return profile.public_display_name
    if (profile?.full_name) return profile.full_name
    return `Learner_${(user?.id || "student").slice(0, 6)}`
  }, [profile, user])

  // Sync current student's stats to campus backend store & fetch live standings
  useEffect(() => {
    let isMounted = true

    // Load timeframe cache first
    try {
      const cached = localStorage.getItem(`coursepilot_leaderboard_cache_${timeframe}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRemoteRankings(parsed)
        }
      }
    } catch {}

    async function syncAndFetch() {
      setLoading(true)

      // Parallel execution: sync user stats AND fetch live campus standings simultaneously
      const syncPromise = user?.id
        ? syncUserLearningStats({
            user_id: user.id,
            full_name: profile?.full_name || "Student",
            public_display_name: userDisplayName,
            avatar_url: profile?.avatar_url || null,
            semester: profile?.semester || 3,
            section: profile?.section || "B2",
            total_xp: totalXP,
            this_week_xp: thisWeekXP,
            streak: streak,
            reputation: profile?.reputation || reputation || 91,
            solved_count: Math.floor(totalXP / 25),
          })
        : Promise.resolve(null)

      const fetchPromise = fetchCampusLeaderboard(timeframe)

      try {
        const [, leaderboardData] = await Promise.all([syncPromise, fetchPromise])

        if (isMounted && Array.isArray(leaderboardData) && leaderboardData.length > 0) {
          setRemoteRankings(leaderboardData)
          try {
            localStorage.setItem(
              `coursepilot_leaderboard_cache_${timeframe}`,
              JSON.stringify(leaderboardData)
            )
          } catch {}
          setLoading(false)
          return
        }
      } catch (e) {
        console.warn("Leaderboard live sync note:", e)
      }

      // Fallback: Query Supabase student_profiles
      try {
        const { data } = await supabase
          .from("student_profiles")
          .select("id, full_name, semester, section")
          .order("created_at", { ascending: true })

        if (isMounted && data && data.length > 0) {
          const fallbackList = data.map((p, i) => ({
            id: p.id,
            display_name: p.full_name || `Learner_${p.id.slice(0, 6)}`,
            avatar_url: p.id === user?.id ? profile?.avatar_url : null,
            semester: p.semester,
            section: p.section,
            xp: p.id === user?.id ? (timeframe === "weekly" ? thisWeekXP : totalXP) : 0,
            streak: p.id === user?.id ? streak : 0,
            reputation: 90,
            solved: p.id === user?.id ? Math.floor(totalXP / 25) : 0,
            rank: i + 1,
          }))
          setRemoteRankings(fallbackList)
          try {
            localStorage.setItem(
              `coursepilot_leaderboard_cache_${timeframe}`,
              JSON.stringify(fallbackList)
            )
          } catch {}
        }
      } catch (err) {
        console.error("Leaderboard fallback note:", err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    syncAndFetch()

    return () => {
      isMounted = false
    }
  }, [user, profile, userDisplayName, totalXP, thisWeekXP, streak, reputation, timeframe])

  // Map and mark the current user in the live list
  const rankedList = useMemo(() => {
    const list = remoteRankings.map((item) => {
      const isCurrentUser = item.id === user?.id
      return {
        ...item,
        isCurrentUser,
        display_name: isCurrentUser ? userDisplayName : item.display_name,
        avatar_url: isCurrentUser ? profile?.avatar_url || item.avatar_url : item.avatar_url,
      }
    })

    // If current user not in remote list, append them
    if (user?.id && !list.some((it) => it.id === user.id)) {
      list.push({
        id: user.id,
        display_name: userDisplayName,
        avatar_url: profile?.avatar_url || null,
        semester: profile?.semester || 3,
        section: profile?.section || "B2",
        xp: timeframe === "weekly" ? thisWeekXP : totalXP,
        streak: streak,
        reputation: reputation,
        solved: Math.floor(totalXP / 25),
        isCurrentUser: true,
      })
    }

    // Sort descending by XP
    list.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp
      return (b.solved || 0) - (a.solved || 0)
    })

    return list.map((item, idx) => ({ ...item, rank: idx + 1 }))
  }, [remoteRankings, user, profile, userDisplayName, totalXP, thisWeekXP, streak, reputation, timeframe])

  // Current student rank entry
  const currentUserRankEntry = useMemo(() => {
    return (
      rankedList.find((item) => item.isCurrentUser) || {
        rank: 1,
        xp: totalXP,
        display_name: userDisplayName,
        streak: streak,
      }
    )
  }, [rankedList, totalXP, userDisplayName, streak])

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
            CAMPUS LEARNING STANDINGS
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Live cross-device learning rankings for you and your classmates.
          </p>
        </div>

        {/* Timeframe Selector */}
        <div className="flex items-center rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 self-start sm:self-auto">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => setTimeframe(tf.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                timeframe === tf.id
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Authenticated Student Standing Pinned Card */}
      <div className="rounded-3xl border border-blue-200 bg-linear-to-r from-blue-50 via-indigo-50/50 to-white p-4 sm:p-5 shadow-xs dark:border-blue-900/50 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-sm shadow-blue-500/20">
              #{currentUserRankEntry.rank}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                YOUR STANDING
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentUserRankEntry.display_name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Semester {profile?.semester || 3} · Section {profile?.section || "B2"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="rounded-2xl bg-white px-3.5 py-2 text-center border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Total XP</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                ⭐ {currentUserRankEntry.xp?.toLocaleString()}
              </span>
            </div>

            <div className="rounded-2xl bg-white px-3.5 py-2 text-center border border-slate-200/60 dark:bg-slate-800 dark:border-slate-700">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Streak</span>
              <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                🔥 {currentUserRankEntry.streak}d
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Rankings */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-5 py-3.5 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Campus Standings ({rankedList.length} Active {rankedList.length === 1 ? "Learner" : "Learners"})
          </h3>
          <span className="text-[11px] font-medium text-slate-400">
            Real Student Data Only
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading campus standings...</div>
        ) : rankedList.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-3xl">🏆</span>
            <h4 className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">No peers yet</h4>
            <p className="text-xs text-slate-500 mt-1">
              Solve daily challenges to earn XP and claim the #1 spot!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rankedList.map((peer) => {
              const medal = peer.rank === 1 ? "🥇" : peer.rank === 2 ? "🥈" : peer.rank === 3 ? "🥉" : null

              return (
                <div
                  key={peer.id}
                  className={`flex items-center justify-between p-4 sm:px-5 transition ${
                    peer.isCurrentUser
                      ? "bg-blue-50/50 dark:bg-blue-950/30 font-semibold"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {/* Left: Rank & Avatar & Name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold">
                      {medal || <span className="text-slate-400 text-xs">#{peer.rank}</span>}
                    </div>

                    <div className="relative">
                      {peer.avatar_url ? (
                        <img
                          src={peer.avatar_url}
                          alt={peer.display_name}
                          className="h-10 w-10 rounded-2xl object-cover ring-2 ring-blue-500/20"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-slate-700 to-slate-900 text-sm font-bold text-white">
                          {(peer.display_name || "S").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {peer.display_name}
                        </span>
                        {peer.isCurrentUser && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[9px] font-extrabold uppercase text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        Semester {peer.semester || 3} · Section {peer.section || "B2"}
                      </span>
                    </div>
                  </div>

                  {/* Right: Stats */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-right">
                    <div>
                      <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        ⭐ {peer.xp?.toLocaleString()} XP
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {peer.streak > 0 ? `🔥 ${peer.streak}d streak` : "0d streak"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
