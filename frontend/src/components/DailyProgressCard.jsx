import { memo } from "react"

function DailyProgressCard({
  completedCount = 0,
  totalCount = 5,
  isSetComplete = false,
  isBonusMode = false,
  adaptiveLevel = "Medium",
  onToggleBonusMode,
}) {
  const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0
  const remaining = Math.max(0, totalCount - completedCount)

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Progress Summary */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200/60">
              {isBonusMode ? "BONUS CHALLENGES" : "DAILY LEARNING GOAL"}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Level: {adaptiveLevel}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>{isSetComplete ? "Daily Set Completed" : `${completedCount} of ${totalCount} Challenges Completed`}</span>
            {isSetComplete && <span className="text-xs font-semibold text-emerald-600">+50 XP Bonus Earned</span>}
          </h3>

          <p className="text-xs text-slate-500 font-normal">
            {isSetComplete
              ? "All 5 core challenges completed for today. Bonus mode is unlocked."
              : `${remaining} more ${remaining === 1 ? "challenge" : "challenges"} left to complete today's set.`}
          </p>

          {/* Progress Bar */}
          <div className="pt-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isSetComplete ? "bg-emerald-600" : "bg-blue-600"
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-[0.98]"
            >
              <span>Start Bonus Set (+5)</span>
            </button>
          )}

          {isBonusMode && (
            <button
              type="button"
              onClick={onToggleBonusMode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>← Back to Daily Set</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(DailyProgressCard)
