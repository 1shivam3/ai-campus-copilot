import { useState, useEffect, useMemo, memo } from "react"
import { getClassStatus, formatRoom } from "../utils/classStatus"

function TodayTimetableStrip({
  schedule = [],
  profile = null,
  onNavigateToAcademics,
}) {
  // Live ticking clock (updates every 30 seconds for real-time transitions)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000) // 30-second interval

    return () => clearInterval(timer)
  }, [])

  // Calculate authoritative class status
  const classStatus = useMemo(() => {
    return getClassStatus(schedule, currentTime)
  }, [schedule, currentTime])

  const {
    state,
    dayName,
    isWeekend,
    totalClasses,
    todaysClasses,
    currentClass,
    nextClass,
    classItem,
    countdownText,
  } = classStatus

  const sectionLabel = profile?.section ? ` · Section ${profile.section}` : ""

  return (
    <section className="mb-6 rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs transition-all dark:border-slate-800/80 dark:bg-slate-900">
      {/* 1. Top Section Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              state === "current"
                ? "bg-emerald-500 animate-pulse"
                : state === "next"
                ? "bg-blue-600 animate-pulse"
                : "bg-slate-400"
            }`}
          />
          <h2 className="text-xs font-bold tracking-widest text-slate-800 uppercase dark:text-slate-200">
            TODAY · {dayName.toUpperCase()}{sectionLabel.toUpperCase()}
          </h2>
          {totalClasses > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {totalClasses} {totalClasses === 1 ? "Class" : "Classes"} Today
            </span>
          )}
        </div>

        {onNavigateToAcademics && (
          <button
            type="button"
            onClick={onNavigateToAcademics}
            className="self-start sm:self-auto text-xs font-bold text-blue-600 hover:text-blue-700 transition dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>Full Schedule</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* 2. Hero Featured Card (Current / Next / Completed / Empty) */}
      {state === "none" ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center dark:border-slate-800 dark:bg-slate-800/30">
          <span className="text-2xl mb-1">{isWeekend ? "🏖️" : "📅"}</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            NO CLASSES TODAY
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isWeekend
              ? "It's the weekend! Time to recharge, study, or review flashcards."
              : "No classes scheduled for today. Enjoy your self-directed study day."}
          </p>
        </div>
      ) : state === "completed" ? (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 text-center dark:border-slate-800 dark:bg-slate-800/40">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/70 dark:bg-slate-700 px-3 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <span>✓</span>
            <span>ALL CLASSES COMPLETE</span>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
            All {totalClasses} classes scheduled for today have finished.
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Great job! Use the remaining time to review notes or tackle tasks.
          </p>
        </div>
      ) : (
        /* Active or Next Class Hero Card */
        <div
          className={`mb-5 rounded-2xl p-4 sm:p-5 transition-all ${
            state === "current"
              ? "border-2 border-emerald-500 bg-emerald-50/40 shadow-xs dark:border-emerald-500/80 dark:bg-emerald-950/20 ring-2 ring-emerald-500/10"
              : "border border-blue-200/90 bg-blue-50/30 shadow-xs dark:border-blue-900/60 dark:bg-blue-950/20"
          }`}
        >
          {/* Top Status & Countdown Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  state === "current"
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {state === "current" ? "CURRENT CLASS" : "NEXT CLASS"}
              </span>

              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                  (classItem?.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
                  (classItem?.subject_name || "").toLowerCase().includes("lab")
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300"
                    : "bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {(classItem?.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
                (classItem?.subject_name || "").toLowerCase().includes("lab")
                  ? "🧪 Lab"
                  : "📖 Theory"}
              </span>
            </div>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                state === "current"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
              }`}
            >
              ⏱️ {countdownText}
            </span>
          </div>

          {/* Subject Title and Timing */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                {classItem?.academic_subjects?.subject_code || classItem?.subject_code || "ACADEMIC"}
              </p>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {classItem?.academic_subjects?.subject_name || classItem?.subject_name || "Course Class"}
              </h3>
            </div>

            <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 bg-white/80 dark:bg-slate-800/80 rounded-xl px-3 py-1.5 border border-slate-200/60 dark:border-slate-700 shrink-0 self-start sm:self-auto">
              {classItem?.start_time?.slice(0, 5)} – {classItem?.end_time?.slice(0, 5)}
            </div>
          </div>

          {/* Meta: Room & Faculty */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-800 px-3 py-1 font-bold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700">
              📍 {classItem?.formattedRoom || formatRoom(classItem?.room || classItem?.room_number)}
            </span>

            {classItem?.teacher_name && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-800 px-3 py-1 font-medium text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                👨‍🏫 {classItem.teacher_name}
              </span>
            )}

            {state === "current" && nextClass && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 ml-auto hidden md:inline">
                Up next: {nextClass.academic_subjects?.subject_name || nextClass.subject_name} at {nextClass.start_time?.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. All Today's Classes Strip */}
      {todaysClasses.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Today&apos;s Schedule Sequence
            </p>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible">
            {todaysClasses.map((item) => {
              const isNow = currentClass && item.id === currentClass.id
              const isNext = !currentClass && nextClass && item.id === nextClass.id
              const subjectName =
                item.academic_subjects?.subject_name || item.subject_name || "Academic Class"
              const subjectCode =
                item.academic_subjects?.subject_code || item.subject_code || ""
              const isLab =
                (item.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
                subjectName.toLowerCase().includes("lab")
              const roomDisplay = item.formattedRoom || formatRoom(item.room || item.room_number)

              return (
                <div
                  key={item.id}
                  className={`relative flex min-w-[210px] sm:min-w-0 flex-col justify-between rounded-2xl p-3.5 transition-all duration-150 ${
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
                      className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1"
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
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/80 pt-2.5 text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
                    <span className="font-semibold text-[11px]">
                      ⏱️ {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                    </span>
                    <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                      📍 {roomDisplay}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

export default memo(TodayTimetableStrip)
