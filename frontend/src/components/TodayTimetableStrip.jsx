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
    <section className="mb-6 rounded-2xl border border-[#E4E4E7] bg-white p-4 sm:p-5 shadow-2xs transition-all dark:border-[#27343a] dark:bg-[#141c1f]">
      {/* 1. Top Section Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E4E4E7] pb-3 dark:border-[#27343a]">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2 w-2 rounded-full ${
              state === "current"
                ? "bg-[#15803D] animate-pulse"
                : state === "next"
                ? "bg-[#0F766E] animate-pulse"
                : "bg-[#A1A1AA]"
            }`}
          />
          <h2 className="text-[11px] font-bold tracking-wider text-[#18181B] uppercase dark:text-[#f4f4f5]">
            TODAY · {dayName.toUpperCase()}{sectionLabel.toUpperCase()}
          </h2>
          {totalClasses > 0 && (
            <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
              {totalClasses} {totalClasses === 1 ? "Class" : "Classes"}
            </span>
          )}
        </div>

        {onNavigateToAcademics && (
          <button
            type="button"
            onClick={onNavigateToAcademics}
            className="self-start sm:self-auto text-xs font-semibold text-[#0F766E] hover:text-[#115E59] transition flex items-center gap-1 dark:text-[#2DD4BF]"
          >
            <span>Full Schedule</span>
            <span>→</span>
          </button>
        )}
      </div>

      {/* 2. Hero Featured Card (Current / Next / Completed / Empty) */}
      {state === "none" ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E4E4E7] bg-[#F7F7F2] p-6 text-center dark:border-[#27343a] dark:bg-[#182226]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#E4E4E7] shadow-2xs mb-2 text-[#71717A] dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#a1a1aa]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#18181B] dark:text-[#f4f4f5]">
            NO CLASSES TODAY
          </h3>
          <p className="text-xs text-[#52525B] mt-0.5 max-w-sm dark:text-[#a1a1aa]">
            {isWeekend
              ? "It's the weekend. Use this free study window to revise or tackle upcoming tasks."
              : "No classes scheduled for today. Enjoy your self-directed study day."}
          </p>
        </div>
      ) : state === "completed" ? (
        <div className="rounded-xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 text-center dark:border-[#27343a] dark:bg-[#182226]">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E4E4E7] px-3 py-0.5 text-[10px] font-bold text-[#18181B] uppercase tracking-wider dark:bg-[#27343a] dark:text-[#f4f4f5]">
            <span>✓</span>
            <span>ALL CLASSES COMPLETE</span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">
            All {totalClasses} classes scheduled for today have concluded.
          </p>
        </div>
      ) : (
        /* Active or Next Class Hero Card */
        <div
          className={`mb-4 rounded-xl p-4 transition-all ${
            state === "current"
              ? "border border-[#15803D]/60 bg-[#ECFDF5]/50 shadow-2xs dark:border-[#2DD4BF]/40 dark:bg-[#182226]"
              : "border border-[#0F766E]/40 bg-[#F7F7F2] shadow-2xs dark:border-[#0F766E]/40 dark:bg-[#182226]"
          }`}
        >
          {/* Top Status & Countdown Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  state === "current"
                    ? "bg-[#15803D] text-white"
                    : "bg-[#0F766E] text-white"
                }`}
              >
                {state === "current" ? "Current Class" : "Next Class"}
              </span>

              <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#52525B] border border-[#E4E4E7] dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#a1a1aa]">
                {(classItem?.academic_subjects?.subject_type || "").toLowerCase().includes("lab") ||
                (classItem?.subject_name || "").toLowerCase().includes("lab")
                  ? "Lab Practical"
                  : "Lecture"}
              </span>
            </div>

            <span className="font-mono text-xs font-semibold text-[#18181B] bg-white px-2.5 py-0.5 rounded-md border border-[#E4E4E7] shadow-2xs dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#f4f4f5]">
              {countdownText}
            </span>
          </div>

          {/* Subject Title and Timing */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF]">
                {classItem?.academic_subjects?.subject_code || classItem?.subject_code || "ACADEMIC"}
              </p>
              <h3 className="text-base font-bold text-[#18181B] tracking-tight dark:text-[#f4f4f5]">
                {classItem?.academic_subjects?.subject_name || classItem?.subject_name || "Course Class"}
              </h3>
            </div>

            <div className="font-mono text-xs font-bold text-[#18181B] bg-white rounded-lg px-2.5 py-1 border border-[#E4E4E7] shrink-0 self-start sm:self-auto dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#f4f4f5]">
              {classItem?.start_time?.slice(0, 5)} – {classItem?.end_time?.slice(0, 5)}
            </div>
          </div>

          {/* Meta: Room & Faculty */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-[#E4E4E7] text-xs dark:border-[#27343a]">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-[#18181B] border border-[#E4E4E7] dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#f4f4f5]">
              <svg className="h-3.5 w-3.5 text-[#71717A] dark:text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Room {classItem?.formattedRoom || formatRoom(classItem?.room || classItem?.academic_subjects?.room || classItem?.room_number)}</span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium text-[#52525B] border border-[#E4E4E7] dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#a1a1aa]">
              <svg className="h-3.5 w-3.5 text-[#71717A] dark:text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{classItem?.teacher_name || classItem?.academic_subjects?.teacher_name || "Faculty not assigned"}</span>
            </span>

            {state === "current" && nextClass && (
              <span className="text-[11px] font-medium text-[#71717A] ml-auto hidden md:inline dark:text-[#a1a1aa]">
                Up next: {nextClass.academic_subjects?.subject_name || nextClass.subject_name} at {nextClass.start_time?.slice(0, 5)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 3. All Today's Classes Sequence */}
      {todaysClasses.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717A] mb-2 dark:text-[#a1a1aa]">
            Today&apos;s Class Sequence
          </p>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {todaysClasses.map((item) => {
              const isNow = currentClass && item.id === currentClass.id
              const isNext = !currentClass && nextClass && item.id === nextClass.id
              const subjectName =
                item.academic_subjects?.subject_name || item.subject_name || "Academic Class"
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
                      ? "border-[#15803D] bg-[#ECFDF5]/60 shadow-2xs dark:border-[#2DD4BF] dark:bg-[#182226]"
                      : isNext
                      ? "border-[#0F766E] bg-[#ECFDF5]/40 shadow-2xs dark:border-[#0F766E] dark:bg-[#182226]"
                      : "border-[#E4E4E7] bg-[#F7F7F2] hover:bg-white dark:border-[#27343a] dark:bg-[#182226] dark:hover:bg-[#1e2c31]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-[#18181B] dark:text-[#f4f4f5]">
                      {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                    </span>
                    <span className="rounded px-1.5 py-0.2 text-[9px] font-bold uppercase text-[#52525B] bg-white border border-[#E4E4E7] dark:bg-[#141c1f] dark:border-[#27343a] dark:text-[#a1a1aa]">
                      {isLab ? "Lab" : "Theory"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-[#18181B] truncate dark:text-[#f4f4f5]" title={subjectName}>
                      {subjectName}
                    </h4>
                    <p className="text-[11px] text-[#52525B] truncate mt-0.5 dark:text-[#a1a1aa]">
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
