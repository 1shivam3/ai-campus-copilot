export default function DailyProgressCard({
  completedCount = 0,
  totalCount = 5,
  isSetComplete = false,
  isBonusMode = false,
  adaptiveLevel = "Medium",
  onClaimBonus,
  onToggleBonusMode,
}) {
  const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0
  const remaining = Math.max(0, totalCount - completedCount)

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs transition-all dark:border-slate-800/80 dark:bg-slate-900">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Progress Summary */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/40">
              {isBonusMode ? "⚡ BONUS CHALLENGE MODE" : "🎯 TODAY'S CHALLENGE SET"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Adaptive Level: {adaptiveLevel}
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{isSetComplete ? "🎉 Daily Set Completed!" : `${completedCount} of ${totalCount} Challenges Completed`}</span>
            {isSetComplete && <span className="text-sm">⭐ +50 XP Bonus</span>}
          </h3>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSetComplete
              ? "You crushed today's 5 universal challenges. Bonus Mode unlocked for extra XP!"
              : `${remaining} more ${remaining === 1 ? "challenge" : "challenges"} left to unlock today's +50 XP completion bonus.`}
          </p>

          {/* Progress Bar */}
          <div className="pt-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isSetComplete
                    ? "bg-linear-to-r from-emerald-500 to-teal-400"
                    : "bg-linear-to-r from-blue-600 to-indigo-600"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Action Button */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          {isSetComplete && !isBonusMode && (
            <button
              type="button"
              onClick={onToggleBonusMode}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-[0.98]"
            >
              <span>⚡ Start Bonus Set (+5)</span>
            </button>
          )}

          {isBonusMode && (
            <button
              type="button"
              onClick={onToggleBonusMode}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>← Back to Daily Set</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
