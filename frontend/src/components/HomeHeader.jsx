import { useMemo } from "react"

export default function HomeHeader({
  user,
  profile,
  totalXP = 0,
  thisWeekXP = 0,
  streak = 0,
  reputation = 91,
  unreadCount = 0,
  onOpenProfile,
  onOpenNotifications,
  onOpenSearch,
}) {
  const initial = (profile?.full_name || user?.email || "S").charAt(0).toUpperCase()

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }, [])

  return (
    <header className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all dark:border-slate-800/80 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Interactive Mini-Profile Strip */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="group flex items-center gap-3.5 text-left transition hover:opacity-90 active:scale-[0.99] focus:outline-hidden"
          title="Open Full Profile & Settings"
        >
          {/* Avatar / Profile Photo */}
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || "Profile"}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-blue-500/30 dark:ring-blue-400/30"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-indigo-700 text-lg font-bold text-white shadow-sm shadow-blue-500/20">
                {initial}
              </div>
            )}
            <span
              className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
              title="Active Student"
            />
          </div>

          {/* Student Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
                {profile?.full_name || user?.email?.split("@")[0] || "Student"}
              </h1>
              <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">
                ⚙️
              </span>
            </div>

            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Semester {profile?.semester || 3} · Section {profile?.section || "B2"}
              {profile?.program ? ` · ${profile.program.split(" ")[0]}` : ""}
            </p>
          </div>
        </button>

        {/* Right: Real Learning Stats Badges & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Streak Indicator */}
          <div
            className="flex items-center gap-1.5 rounded-2xl border border-orange-200/80 bg-orange-50/80 px-3 py-1.5 text-xs font-bold text-orange-800 shadow-2xs dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-300"
            title="Continuous days of verified academic learning activity"
          >
            <span className="text-sm">🔥</span>
            <span>{streak} {streak === 1 ? "day" : "days"} streak</span>
          </div>

          {/* Total XP & Weekly XP */}
          <div
            className="flex items-center gap-1.5 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-bold text-amber-800 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300"
            title={`Total Learning XP. +${thisWeekXP} XP earned in the last 7 days.`}
          >
            <span className="text-sm">⭐</span>
            <span>{totalXP.toLocaleString()} XP</span>
            {thisWeekXP > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                (+{thisWeekXP})
              </span>
            )}
          </div>

          {/* Community Reputation Score */}
          <div
            className="flex items-center gap-1.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
            title="Community Reputation based on verified explanations and peer feedback"
          >
            <span className="text-sm">🏆</span>
            <span>{reputation}% Rep</span>
          </div>

          {/* Quick Action: Search & Notifications */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Global Search (Ctrl+K)"
              >
                <span>🔍</span>
                <span className="hidden md:inline text-[11px] text-slate-400">Ctrl K</span>
              </button>
            )}

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title="Smart Notifications"
              >
                <span>🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
