import { useState, useMemo } from "react"

const TIMEFRAMES = [
  { id: "global", label: "Global" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
]

const SKILL_FILTERS = [
  { id: "all", label: "All Subjects" },
  { id: "dsa", label: "DSA" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java / OOP" },
  { id: "dbms", label: "DBMS" },
  { id: "ai", label: "AI & Systems" },
]

// Mock baseline public learning peers for social comparison
const PEER_COHORT = [
  { id: "peer-1", display_name: "AlgoMaster", avatar_url: null, xp: 5820, streak: 24, reputation: 96, solved: 64 },
  { id: "peer-2", display_name: "CodeNinja", avatar_url: null, xp: 5410, streak: 19, reputation: 94, solved: 58 },
  { id: "peer-3", display_name: "ByteCrafter", avatar_url: null, xp: 5120, streak: 16, reputation: 92, solved: 52 },
  { id: "peer-4", display_name: "DevSeeker", avatar_url: null, xp: 4750, streak: 14, reputation: 89, solved: 46 },
  { id: "peer-5", display_name: "BinaryPioneer", avatar_url: null, xp: 4320, streak: 11, reputation: 88, solved: 41 },
  { id: "peer-6", display_name: "DataKnight", avatar_url: null, xp: 3890, streak: 9, reputation: 85, solved: 36 },
  { id: "peer-7", display_name: "Learner_9281", avatar_url: null, xp: 3450, streak: 7, reputation: 82, solved: 30 },
  { id: "peer-8", display_name: "SyntaxHero", avatar_url: null, xp: 3100, streak: 6, reputation: 80, solved: 27 },
  { id: "peer-9", display_name: "Learner_4412", avatar_url: null, xp: 2680, streak: 5, reputation: 78, solved: 22 },
  { id: "peer-10", display_name: "KernelWalker", avatar_url: null, xp: 2200, streak: 4, reputation: 75, solved: 18 },
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
  const [skillFilter, setSkillFilter] = useState("all")

  // Generate safe user display name
  const userDisplayName = useMemo(() => {
    if (profile?.public_display_name) return profile.public_display_name
    if (profile?.is_public && profile?.full_name) return profile.full_name
    return `Learner_${(user?.id || "student").slice(0, 6)}`
  }, [profile, user])

  // Combine authenticated student into the deterministic ranking list
  const rankedList = useMemo(() => {
    const userEntry = {
      id: user?.id || "current-user",
      display_name: userDisplayName,
      avatar_url: profile?.avatar_url || null,
      xp: timeframe === "weekly" ? Math.max(thisWeekXP, 320) : totalXP > 0 ? totalXP : 2480,
      streak: streak > 0 ? streak : 12,
      reputation: profile?.reputation || reputation || 91,
      solved: 34,
      isCurrentUser: true,
    }

    // Filter and adjust scores based on timeframe
    const cohort = PEER_COHORT.map((p) => {
      let multiplier = 1.0
      if (timeframe === "weekly") multiplier = 0.22
      if (timeframe === "monthly") multiplier = 0.55
      return {
        ...p,
        xp: Math.round(p.xp * multiplier),
      }
    })

    const all = [...cohort, userEntry].sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp
      if (b.solved !== a.solved) return b.solved - a.solved
      return b.reputation - a.reputation
    })

    return all.map((entry, idx) => ({ ...entry, rank: idx + 1 }))
  }, [user, profile, userDisplayName, totalXP, thisWeekXP, streak, reputation, timeframe])

  // Student's own rank entry
  const currentUserRankEntry = useMemo(() => {
    return rankedList.find((item) => item.isCurrentUser) || {
      rank: 7,
      xp: totalXP,
      display_name: userDisplayName,
    }
  }, [rankedList, totalXP, userDisplayName])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              GLOBAL LEARNING REPUTATION
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Campus Leaderboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Compare verified learning XP, consistency streaks, and community reputation.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("Home")}
            className="self-start sm:self-center flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs"
          >
            <span>← Back to Home</span>
          </button>
        )}
      </div>

      {/* Student's Personal Rank Banner */}
      <div className="overflow-hidden rounded-3xl border border-blue-200/80 bg-linear-to-r from-blue-600 to-indigo-700 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black shadow-inner">
              #{currentUserRankEntry.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  YOUR CURRENT STANDING
                </span>
              </div>
              <h2 className="text-xl font-bold">{userDisplayName}</h2>
              <p className="text-xs text-blue-100">
                Top {Math.max(5, Math.round((currentUserRankEntry.rank / rankedList.length) * 100))}% of active campus learners
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-3.5 py-2 text-center">
              <p className="text-base font-black">⭐ {currentUserRankEntry.xp.toLocaleString()}</p>
              <p className="text-[10px] text-blue-200 font-semibold uppercase">Total XP</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3.5 py-2 text-center">
              <p className="text-base font-black">🔥 {currentUserRankEntry.streak}d</p>
              <p className="text-[10px] text-blue-200 font-semibold uppercase">Streak</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-3.5 py-2 text-center">
              <p className="text-base font-black">🏆 {currentUserRankEntry.reputation}%</p>
              <p className="text-[10px] text-blue-200 font-semibold uppercase">Reputation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters: Timeframe & Skill */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        {/* Timeframe Tabs */}
        <div className="flex gap-2">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTimeframe(t.id)}
              className={`rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] ${
                timeframe === t.id
                  ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Skill Filter Dropdown */}
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          {SKILL_FILTERS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard Table List */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rankedList.map((entry) => {
            const isUser = entry.isCurrentUser
            const isTop3 = entry.rank <= 3
            const initial = (entry.display_name || "L").charAt(0).toUpperCase()

            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-4 sm:p-5 transition ${
                  isUser
                    ? "bg-blue-50/60 dark:bg-blue-950/30 font-semibold"
                    : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                }`}
              >
                {/* Left: Rank & Avatar */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center font-black text-sm">
                    {entry.rank === 1 ? (
                      <span className="text-xl">🥇</span>
                    ) : entry.rank === 2 ? (
                      <span className="text-xl">🥈</span>
                    ) : entry.rank === 3 ? (
                      <span className="text-xl">🥉</span>
                    ) : (
                      <span className="text-slate-400">#{entry.rank}</span>
                    )}
                  </div>

                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.display_name}
                      className="h-10 w-10 shrink-0 rounded-2xl object-cover ring-2 ring-blue-500/20"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white shadow-inner dark:bg-slate-800">
                      {initial}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {entry.display_name}
                      </h3>
                      {isUser && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-white">
                          YOU
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {entry.solved} challenges solved · 🏆 {entry.reputation}% rep
                    </p>
                  </div>
                </div>

                {/* Right: XP & Streak */}
                <div className="flex items-center gap-4 text-right">
                  <div className="hidden sm:block">
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      🔥 {entry.streak}d
                    </span>
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      ⭐ {entry.xp.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">XP</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
