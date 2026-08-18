import { useEffect, useState } from "react"
import { getAcademicData, getClassSchedule } from "../lib/academicData"
import { getSyncMetadata } from "../lib/offlineDb"
import { formatRoom } from "../utils/classStatus"
import { SkeletonGrid } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function MyAcademics({ profile }) {
  const [subjects, setSubjects] = useState([])
  const [labs, setLabs] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastSyncedStr, setLastSyncedStr] = useState("")
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    loadAcademicData()
  }, [profile])

  async function loadAcademicData() {
    if (!profile) return

    setLoading(true)
    setError("")

    try {
      const [academicData, scheduleData, meta] = await Promise.all([
        getAcademicData(profile.semester, profile.section),
        getClassSchedule(profile.semester, profile.section),
        getSyncMetadata(`schedule_${profile.semester}_${profile.section}`),
      ])

      setSubjects(academicData.subjects || [])
      setLabs(academicData.labs || [])
      setSchedule(scheduleData || [])

      if (meta?.last_synced_at) {
        const d = new Date(meta.last_synced_at)
        setLastSyncedStr(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
      }
    } catch (err) {
      console.error(err)
      setError("Could not load your academic schedule and courses.")
    } finally {
      setLoading(false)
    }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
  const todaysClasses = schedule
    .filter((item) => item.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Page Heading */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                ACADEMIC TIMETABLE & COURSES
              </p>
              {!isOnline ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Offline Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Synced
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Semester {profile?.semester} · Section {profile?.section}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal">
              Official lecture schedule, laboratory practicals, and faculty directory.
              {lastSyncedStr && (
                <span className="text-slate-400"> (Last synced at {lastSyncedStr})</span>
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-2xs self-start sm:self-auto">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              TODAY
            </p>
            <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 font-mono">
              {today}, {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={loadAcademicData} />
          </div>
        )}

        {loading ? (
          <div className="space-y-8">
            <SkeletonGrid count={3} />
            <SkeletonGrid count={3} />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Today's Classes */}
            <section>
              <div className="mb-3.5">
                <h2 className="text-base font-bold text-slate-900">
                  Today&apos;s Lectures ({today})
                </h2>
              </div>

              {todaysClasses.length === 0 ? (
                <EmptyState
                  icon="📅"
                  title="No classes scheduled today"
                  description="Enjoy your self-directed study day or use free time to revise topics."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {todaysClasses.map((item, index) => {
                    const subject = item.academic_subjects
                    const isNext = index === 0

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 sm:p-5 transition ${
                          isNext
                            ? "border-blue-300 bg-blue-50/40 shadow-xs"
                            : "border-slate-200/80 bg-white shadow-2xs"
                        }`}
                      >
                        {isNext && (
                          <div className="mb-2 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                            <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
                              NEXT CLASS
                            </p>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-blue-600">
                              {subject?.subject_code || "CLASS"}
                            </p>
                            <h3 className="mt-0.5 text-sm sm:text-base font-bold text-slate-900 truncate">
                              {subject?.subject_name || "Course Lecture"}
                            </h3>
                          </div>

                          <div className="text-right font-mono text-xs shrink-0">
                            <p className="font-bold text-slate-900">{item.start_time?.slice(0, 5)}</p>
                            <p className="text-slate-400 text-[11px]">to {item.end_time?.slice(0, 5)}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs border-t border-slate-100 pt-2.5">
                          <span className="font-medium text-slate-600">
                            👨‍🏫 {item.teacher_name || item.academic_subjects?.teacher_name || "Faculty not assigned"}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-semibold text-slate-700">
                            📍 Room {formatRoom(item.room || item.academic_subjects?.room)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Weekly Timetable */}
            <section>
              <div className="mb-3.5">
                <h2 className="text-base font-bold text-slate-900">
                  Weekly Class Timetable
                </h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {days.map((day) => {
                  const dayClasses = schedule
                    .filter((item) => item.day_of_week?.toLowerCase() === day.toLowerCase())
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))

                  return (
                    <div
                      key={day}
                      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs"
                    >
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">{day}</h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                          {dayClasses.length} {dayClasses.length === 1 ? "class" : "classes"}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {dayClasses.length === 0 ? (
                          <div className="p-4 text-xs text-slate-400 text-center">
                            No classes scheduled.
                          </div>
                        ) : (
                          dayClasses.map((item) => {
                            const subject = item.academic_subjects
                            const isLab =
                              subject?.subject_type === "Lab" ||
                              subject?.subject_code?.endsWith("L") ||
                              item.subject_name?.toLowerCase().includes("lab")

                            return (
                              <div key={item.id} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                                <div className="flex gap-3">
                                  <div className="min-w-[60px] font-mono text-xs">
                                    <p className="font-bold text-slate-900">{item.start_time?.slice(0, 5)}</p>
                                    <p className="text-slate-400 text-[10px]">{item.end_time?.slice(0, 5)}</p>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-bold text-blue-600">
                                          {subject?.subject_code}
                                        </p>
                                        <h4 className="font-bold text-xs text-slate-900 truncate">
                                          {subject?.subject_name}
                                        </h4>
                                      </div>

                                      <span
                                        className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                          isLab
                                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                                            : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {isLab ? "Lab" : "Theory"}
                                      </span>
                                    </div>

                                    <p className="mt-1 text-[11px] text-slate-500 truncate">
                                      {item.teacher_name || subject?.teacher_name || "Faculty not assigned"} · Room {formatRoom(item.room || subject?.room)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Labs & Enrolled Courses */}
            <section className="grid gap-6 md:grid-cols-2">
              {/* Lab Schedule */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-3">
                  Laboratory Sessions
                </h3>
                {labs.length === 0 ? (
                  <p className="text-xs text-slate-400">No laboratory practicals assigned for this section.</p>
                ) : (
                  <div className="space-y-2.5">
                    {labs.map((lab) => (
                      <div key={lab.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-slate-900">{lab.subject_name}</h4>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                            {lab.day_of_week}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {lab.start_time?.slice(0, 5)} – {lab.end_time?.slice(0, 5)} · Room {formatRoom(lab.lab_room || lab.room)} · {lab.teacher_name || "Faculty not assigned"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enrolled Courses */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 mb-3">
                  Enrolled Subjects ({subjects.length})
                </h3>
                {subjects.length === 0 ? (
                  <p className="text-xs text-slate-400">No courses loaded.</p>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-[10px] font-bold text-blue-600">{sub.subject_code}</p>
                          <p className="text-xs font-bold text-slate-900 truncate">{sub.subject_name}</p>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium shrink-0">
                          {sub.subject_type || "Theory"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default MyAcademics
