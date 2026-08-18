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
      <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              YOUR NEXT BEST ACTION
            </span>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/60">
            All Caught Up
          </span>
        </div>
        <div className="mt-3">
          <h3 className="text-base font-bold text-slate-900">
            No urgent deadlines or high-risk exams
          </h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            You are completely up to date with your coursework. Consider reviewing syllabus topics in Progress or practicing an adaptive quiz in Exam Mode.
          </p>
        </div>
      </div>
    )
  }

  const isUrgent = action.isHardRule || action.urgency >= 80 || action.risk >= 80
  const isExamAction = action.source === "exams" || action.action_type === "PREPARE_EXAM"
  const isTaskAction = action.source === "tasks" || action.action_type === "COMPLETE_ASSIGNMENT" || action.action_type === "SUBMIT_ASSIGNMENT"

  const durationMins = action.estimated_minutes || 45

  return (
    <div className="mb-6 rounded-2xl border-2 border-blue-600/20 bg-white p-5 shadow-xs transition-all hover:border-blue-600/30">
      {/* Top Header & Priority Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            YOUR NEXT BEST ACTION
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {action.hardRuleReason && (
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200/60">
              {action.hardRuleReason}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isUrgent
                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                : "bg-blue-50 text-blue-700 border border-blue-200/60"
            }`}
          >
            {isUrgent ? "High Priority" : "Recommended Focus"}
          </span>
        </div>
      </div>

      {/* Main Focus Title & Subject Info */}
      <div className="mt-3.5">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
          {action.title}
        </h3>
        <p className="mt-0.5 text-xs font-semibold text-slate-600">
          {action.subject || "Academics"}
          {action.deadline ? ` · Due ${new Date(action.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
        </p>
      </div>

      {/* Why This Now? Reasoning Block */}
      <div className="mt-3.5 rounded-xl bg-slate-50 p-3 border border-slate-200/60">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Why this now?
        </p>
        <p className="mt-1 text-xs text-slate-700 leading-relaxed font-normal">
          {action.description}
        </p>

        {Array.isArray(action.whyThis) && action.whyThis.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {action.whyThis.map((reason, idx) => (
              <li
                key={idx}
                className="rounded-lg bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200/60"
              >
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Action Footer: Estimated Duration & Start CTA */}
      <div className="mt-4 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{durationMins} min estimated</span>
        </div>

        <button
          type="button"
          onClick={() => onExecute(action)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
        >
          <span>Start →</span>
        </button>
      </div>
    </div>
  )
}

export default memo(NextBestActionCard)
