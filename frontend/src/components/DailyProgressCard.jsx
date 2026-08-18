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
    <div className="mb-6 rounded-2xl border border-[#E4E4E7] bg-white p-4 sm:p-5 shadow-2xs transition-all dark:border-[#27343a] dark:bg-[#141c1f]">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Progress Summary */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
              {isBonusMode ? "BONUS CHALLENGES" : "DAILY LEARNING GOAL"}
            </span>
            <span className="rounded-full bg-[#F7F7F2] px-2 py-0.5 text-[10px] font-medium text-[#52525B] border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
              Level: {adaptiveLevel}
            </span>
          </div>

          <h3 className="text-base font-bold text-[#18181B] flex items-center gap-2 dark:text-[#f4f4f5]">
            <span>{isSetComplete ? "Daily Set Completed" : `${completedCount} of ${totalCount} Challenges Completed`}</span>
            {isSetComplete && <span className="text-xs font-semibold text-[#15803D] dark:text-[#2DD4BF]">+50 XP Bonus Earned</span>}
          </h3>

          <p className="text-xs text-[#52525B] font-normal dark:text-[#a1a1aa]">
            {isSetComplete
              ? "All 5 core challenges completed for today. Bonus mode is unlocked."
              : `${remaining} more ${remaining === 1 ? "challenge" : "challenges"} left to complete today's set.`}
          </p>

          {/* Progress Bar */}
          <div className="pt-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F7F7F2] dark:bg-[#182226]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isSetComplete ? "bg-[#15803D]" : "bg-[#0F766E]"
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F766E] px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
            >
              <span>Start Bonus Set (+5)</span>
            </button>
          )}

          {isBonusMode && (
            <button
              type="button"
              onClick={onToggleBonusMode}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2 text-xs font-semibold text-[#52525B] hover:bg-[#F7F7F2] hover:text-[#18181B] transition dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
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
