import { useMemo, memo } from "react"

function HomeHeader({
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
    <header className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all">
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
                className="h-11 w-11 shrink-0 rounded-xl object-cover ring-2 ring-blue-500/20"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-2xs">
                {initial}
              </div>
            )}
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white"
              title="Active Student"
            />
          </div>

          {/* Student Info */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                {profile?.full_name || user?.email?.split("@")[0] || "Student"}
              </h1>
              <svg className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <p className="text-xs font-medium text-slate-500">
              Semester {profile?.semester || 3} · Section {profile?.section || "B2"}
              {profile?.program ? ` · ${profile.program.split(" ")[0]}` : ""}
            </p>
          </div>
        </button>

        {/* Right: Learning Stats Badges & Search Trigger */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Streak Indicator */}
          <div
            className="flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/70 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-2xs"
            title="Continuous days of verified academic learning activity"
          >
            <span className="text-xs">🔥</span>
            <span>{streak} {streak === 1 ? "day" : "days"} streak</span>
          </div>

          {/* Total XP */}
          <div
            className="flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50/70 px-2.5 py-1 text-xs font-bold text-blue-800 shadow-2xs"
            title={`Total Learning XP. +${thisWeekXP} XP earned this week.`}
          >
            <span className="text-xs">⭐</span>
            <span>{totalXP.toLocaleString()} XP</span>
            {thisWeekXP > 0 && (
              <span className="text-[10px] text-blue-600 font-semibold">
                (+{thisWeekXP})
              </span>
            )}
          </div>

          {/* Quick Actions: Search & Notifications */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {onOpenSearch && (
              <button
                type="button"
                onClick={onOpenSearch}
                className="flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Global Search (Ctrl+K)"
              >
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden md:inline text-[10px] font-mono text-slate-400">Ctrl K</span>
              </button>
            )}

            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
                title="Smart Notifications"
              >
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-2xs">
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

export default memo(HomeHeader)
