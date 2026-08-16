import { useMemo } from "react"
import { getTodaySchedule } from "../lib/todaySchedule"

export default function TodayTimetableStrip({
  schedule = [],
  profile = null,
  onNavigateToAcademics,
}) {
  const todayDate = new Date()
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" })
  const isWeekend = dayName === "Saturday" || dayName === "Sunday"

  // Filter today's classes from existing schedule
  const todayClasses = useMemo(() => {
    if (isWeekend) return []
    return getTodaySchedule(schedule, todayDate)
  }, [schedule, isWeekend])

  // Determine current active class or next class
  const { currentClassId, nextClassId } = useMemo(() => {
    const nowStr = todayDate.toTimeString().slice(0, 5) // "HH:MM"
    let currId = null
    let nxtId = null

    for (const item of todayClasses) {
      const start = item.start_time?.slice(0, 5)
      const end = item.end_time?.slice(0, 5)

      if (start && end) {
        if (nowStr >= start && nowStr <= end) {
          currId = item.id
          break
        } else if (start > nowStr && !nxtId) {
          nxtId = item.id
        }
      }
    }

    return { currentClassId: currId, nextClassId: nxtId }
  }, [todayClasses])

  const sectionLabel = profile?.section ? ` · Section ${profile.section}` : ""

  return (
    <section className="mb-8 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs transition-all dark:border-slate-800/80 dark:bg-slate-900">
      {/* Top Section Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse dark:bg-blue-400" />
          <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase dark:text-slate-200">
            TODAY · {dayName.toUpperCase()}{sectionLabel.toUpperCase()}
          </h2>
          {todayClasses.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {todayClasses.length} {todayClasses.length === 1 ? "class" : "classes"}
            </span>
          )}
        </div>

        {onNavigateToAcademics && (
          <button
            type="button"
            onClick={onNavigateToAcademics}
            className="self-start sm:self-auto text-xs font-bold text-blue-600 hover:text-blue-700 transition dark:text-blue-400 hover:underline"
          >
            Weekly Schedule →
          </button>
        )}
      </div>

      {/* Classes Content */}
      {todayClasses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center dark:border-slate-800 dark:bg-slate-800/30">
          <span className="text-2xl mb-1">🏖️</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            NO CLASSES TODAY
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isWeekend
              ? "It's the weekend! Time to recharge or review flashcards."
              : "You have no scheduled classes for today."}
          </p>
        </div>
      ) : (
        /* Horizontally Scrollable on Mobile & Responsive Grid / Flex on Desktop */
        <div className="flex gap-3.5 overflow-x-auto pb-2 pt-1 no-scrollbar sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
          {todayClasses.map((item) => {
            const isNow = item.id === currentClassId
            const isNext = !currentClassId && item.id === nextClassId
            const subjectName =
              item.academic_subjects?.subject_name || item.subject_name || "Academic Class"
            const subjectCode =
              item.academic_subjects?.subject_code || item.subject_code || ""
            const isLab =
              (item.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
              subjectName.toLowerCase().includes("lab")

            return (
              <div
                key={item.id}
                className={`relative flex min-w-[210px] sm:min-w-0 flex-col justify-between rounded-2xl p-4 transition-all duration-150 ${
                  isNow
                    ? "border-2 border-emerald-500 bg-emerald-50/60 shadow-xs dark:border-emerald-500/80 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20"
                    : isNext
                    ? "border-2 border-blue-500 bg-blue-50/60 shadow-xs dark:border-blue-500/80 dark:bg-blue-950/30 ring-2 ring-blue-500/20"
                    : "border border-slate-200/80 bg-slate-50/60 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                }`}
              >
                {/* Top: Status Badges */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-1.5">
                    {isNow ? (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs">
                        NOW
                      </span>
                    ) : isNext ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs">
                        NEXT
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {item.start_time?.slice(0, 5)}
                      </span>
                    )}
                  </div>

                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      isLab
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300"
                        : "bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {isLab ? "🧪 Lab" : "📖 Theory"}
                  </span>
                </div>

                {/* Subject Name & Code */}
                <div>
                  <h3
                    className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1"
                    title={subjectName}
                  >
                    {subjectName}
                  </h3>
                  {subjectCode && (
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-400">
                      {subjectCode}
                    </p>
                  )}
                </div>

                {/* Bottom: Time & Room info */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
                  <span className="font-semibold text-[11px]">
                    ⏱️ {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                  </span>
                  <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                    📍 {item.room_number || "Room TBD"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
