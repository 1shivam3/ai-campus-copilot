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
    }, 30000)

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
    <section className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all">
      {/* 1. Top Section Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2 w-2 rounded-full ${
              state === "current"
                ? "bg-emerald-500 animate-pulse"
                : state === "next"
                ? "bg-blue-600 animate-pulse"
                : "bg-slate-400"
            }`}
          />
          <h2 className="text-[11px] font-bold tracking-wider text-slate-800 uppercase">
            TODAY · {dayName.toUpperCase()}{sectionLabel.toUpperCase()}
          </h2>
          {totalClasses > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200/60">
              {totalClasses} {totalClasses === 1 ? "Class" : "Classes"}
            </span>
          )}
        </div>

        {onNavigateToAcademics && (
          <button
            type="button"
            onClick={onNavigateToAcademics}
            className="self-start sm:self-auto text-xs font-semibold text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
          >
            <span>Full Schedule</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* 2. Hero Featured Card (Current / Next / Completed / Empty) */}
      {state === "none" ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-2xs mb-2 text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            NO CLASSES TODAY
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
            {isWeekend
              ? "It's the weekend. Use this free study window to revise or tackle upcoming tasks."
              : "No classes scheduled for today. Enjoy your self-directed study day."}
          </p>
        </div>
      ) : state === "completed" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-200/80 px-3 py-0.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
            <span>✓</span>
            <span>ALL CLASSES COMPLETE</span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-bold text-slate-800">
            All {totalClasses} classes scheduled for today have concluded.
          </p>
        </div>
      ) : (
        /* Active or Next Class Hero Card */
        <div
          className={`mb-4 rounded-xl p-4 transition-all ${
            state === "current"
              ? "border border-emerald-500/80 bg-emerald-50/30 shadow-2xs"
              : "border border-blue-500/80 bg-blue-50/30 shadow-2xs"
          }`}
        >
          {/* Top Status & Countdown Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  state === "current"
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {state === "current" ? "Current Class" : "Next Class"}
              </span>

              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 border border-slate-200">
                {(classItem?.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
                (classItem?.subject_name || "").toLowerCase().includes("lab")
                  ? "Lab Practical"
                  : "Lecture"}
              </span>
            </div>

            <span className="font-mono text-xs font-semibold text-slate-700 bg-white px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs">
              {countdownText}
            </span>
          </div>

          {/* Subject Title and Timing */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-blue-600">
                {classItem?.academic_subjects?.subject_code || classItem?.subject_code || "ACADEMIC"}
              </p>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {classItem?.academic_subjects?.subject_name || classItem?.subject_name || "Course Class"}
              </h3>
            </div>

            <div className="font-mono text-xs font-bold text-slate-800 bg-white rounded-lg px-2.5 py-1 border border-slate-200 shrink-0 self-start sm:self-auto">
              {classItem?.start_time?.slice(0, 5)} – {classItem?.end_time?.slice(0, 5)}
            </div>
          </div>

          {/* Meta: Room & Faculty */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-200/60 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 border border-slate-200">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Room {classItem?.formattedRoom || formatRoom(classItem?.room || classItem?.academic_subjects?.room || classItem?.room_number)}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{classItem?.teacher_name || classItem?.academic_subjects?.teacher_name || "Faculty not assigned"}</span>
            </span>

            {state === "current" && nextClass && (
              <span className="text-[11px] font-medium text-slate-500 ml-auto hidden md:inline">
                Up next: {nextClass.academic_subjects?.subject_name || nextClass.subject_name} at {nextClass.start_time?.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. All Today's Classes Sequence */}
      {todaysClasses.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Today&apos;s Class Sequence
          </p>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
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
              const roomDisplay = item.formattedRoom || formatRoom(item.room || item.academic_subjects?.room || item.room_number)
              const teacherDisplay = item.teacher_name || item.academic_subjects?.teacher_name || "Faculty not assigned"

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between rounded-xl p-3 border transition-all ${
                    isNow
                      ? "border-emerald-500 bg-emerald-50/40 shadow-2xs"
                      : isNext
                      ? "border-blue-500 bg-blue-50/40 shadow-2xs"
                      : "border-slate-200/80 bg-slate-50/60 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                    </span>
                    <span className="rounded px-1.5 py-0.2 text-[9px] font-bold uppercase text-slate-600 bg-white border border-slate-200">
                      {isLab ? "Lab" : "Theory"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-900 truncate" title={subjectName}>
                      {subjectName}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Room {roomDisplay} · {teacherDisplay}
                    </p>
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
