import { memo } from "react"

function NextBestActionCard({
  action,
  onExecute,
  onOpenTasks,
  onOpenExams,
  onOpenAcademics,
}) {
  if (!action) {
    return (
      <div className="mb-6 rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#15803D]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
              YOUR NEXT BEST ACTION
            </span>
          </div>
          <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D] border border-emerald-200/60 dark:bg-[#182226] dark:text-[#2DD4BF] dark:border-[#2DD4BF]/30">
            All Caught Up
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
            No urgent deadlines or high-risk exams
          </h3>
          <p className="mt-1 text-xs text-[#52525B] leading-relaxed dark:text-[#a1a1aa]">
            You are completely up to date with your coursework. Consider reviewing syllabus topics in Progress or practicing an adaptive quiz in Exam Mode.
          </p>
        </div>
      </div>
    )
  }

  const isUrgent = action.isHardRule || action.urgency >= 80 || action.risk >= 80
  const durationMins = action.estimated_minutes || 45

  return (
    <div className="mb-6 rounded-2xl border-2 border-[#0F766E]/25 bg-white p-5 shadow-xs transition-all hover:border-[#0F766E]/40 dark:border-[#0F766E]/40 dark:bg-[#141c1f]">
      {/* Top Header & Priority Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E4E4E7] dark:border-[#27343a]">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#0F766E] animate-pulse dark:bg-[#2DD4BF]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
            YOUR NEXT BEST ACTION
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {action.hardRuleReason && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-[#DC2626] border border-rose-200/60 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
              {action.hardRuleReason}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isUrgent
                ? "bg-amber-50 text-[#D97706] border border-amber-200/60 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300"
                : "bg-[#ECFDF5] text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:text-[#2DD4BF] dark:border-[#2DD4BF]/30"
            }`}
          >
            {isUrgent ? "High Priority" : "Recommended Focus"}
          </span>
        </div>
      </div>

      {/* Main Focus Title & Subject Info */}
      <div className="mt-3.5">
        <h3 className="text-lg font-bold text-[#18181B] tracking-tight dark:text-[#f4f4f5]">
          {action.title}
        </h3>
        <p className="mt-0.5 text-xs font-semibold text-[#52525B] dark:text-[#a1a1aa]">
          {action.subject || "Academics"}
          {action.deadline ? ` · Due ${new Date(action.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </p>
      </div>

      {/* Why This Now? Reasoning Block */}
      <div className="mt-3.5 rounded-xl bg-[#F7F7F2] p-3.5 border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a]">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
          Why this now?
        </p>
        <p className="mt-1 text-xs text-[#52525B] leading-relaxed font-normal dark:text-[#d4d4d8]">
          {action.description}
        </p>

        {Array.isArray(action.whyThis) && action.whyThis.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {action.whyThis.map((reason, idx) => (
              <li
                key={idx}
                className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-medium text-[#52525B] border border-[#E4E4E7] dark:bg-[#141c1f] dark:text-[#d4d4d8] dark:border-[#27343a]"
              >
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Footer: Estimated Duration & Start CTA */}
      <div className="mt-4 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#71717A] dark:text-[#a1a1aa]">
          <svg className="h-4 w-4 text-[#71717A] dark:text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{durationMins} min estimated</span>
        </div>

        <button
          type="button"
          onClick={() => onExecute(action)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white shadow-2xs transition-all hover:bg-[#115E59] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:outline-none"
        >
          <span>Start →</span>
        </button>
      </div>
    </div>
  )
}

export default memo(NextBestActionCard)
