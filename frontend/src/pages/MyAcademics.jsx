import { useEffect, useState } from "react"
import { getAcademicData, getClassSchedule } from "../lib/academicData"
import { SkeletonGrid } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function MyAcademics({ profile }) {
  const [subjects, setSubjects] = useState([])
  const [labs, setLabs] = useState([])
  const [schedule, setSchedule] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]

  useEffect(() => {
    loadAcademicData()
  }, [profile])

  async function loadAcademicData() {
    if (!profile) return

    setLoading(true)
    setError("")

    try {
      const [academicData, scheduleData] = await Promise.all([
        getAcademicData(profile.semester, profile.section),
        getClassSchedule(profile.semester, profile.section),
      ])

      setSubjects(academicData.subjects || [])
      setLabs(academicData.labs || [])
      setSchedule(scheduleData || [])
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
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              ACADEMIC TIMETABLE & COURSES
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Semester {profile?.semester} · Section {profile?.section}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Your official lecture schedule, laboratory practicals, and faculty directory.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm self-start sm:self-auto">
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              TODAY IS
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
          <div className="space-y-10">
            {/* Today's Classes */}
            <section>
              <div className="mb-4">
                <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                  TODAY&apos;S CLASSES
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  Lectures for {today}
                </h2>
              </div>

              {todaysClasses.length === 0 ? (
                <EmptyState
                  icon="🎉"
                  title="No classes scheduled today"
                  description="Enjoy your open study day or prepare for upcoming exams."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todaysClasses.map((item, index) => {
                    const subject = item.academic_subjects
                    const isNext = index === 0

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-5 shadow-sm transition ${
                          isNext
                            ? "border-blue-300 bg-blue-50/40 shadow-md"
                            : "border-slate-200/80 bg-white"
                        }`}
                      >
                        {isNext && (
                          <div className="mb-2.5 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                            <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
                              NEXT CLASS
                            </p>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-blue-600">
                              {subject?.subject_code || "CLASS"}
                            </p>
                            <h3 className="mt-0.5 text-base font-bold text-slate-900 truncate">
                              {subject?.subject_name || "Course Lecture"}
                            </h3>
                          </div>

                          <div className="text-right font-mono text-xs shrink-0">
                            <p className="font-bold text-slate-900">{item.start_time?.slice(0, 5)}</p>
                            <p className="text-slate-400">to {item.end_time?.slice(0, 5)}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 border border-slate-200">
                            👨‍🏫 {item.teacher_name || "Faculty N/A"}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 border border-slate-200">
                            📍 Room {item.room || "—"}
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
              <div className="mb-4">
                <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  COMPLETE TIMETABLE
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  Weekly Class Schedule
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {days.map((day) => {
                  const dayClasses = schedule
                    .filter((item) => item.day_of_week?.toLowerCase() === day.toLowerCase())
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))

                  return (
                    <div
                      key={day}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md"
                    >
                      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 text-sm">{day}</h3>
                        <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {dayClasses.length} {dayClasses.length === 1 ? "class" : "classes"}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {dayClasses.length === 0 ? (
                          <div className="p-5 text-xs text-slate-400 text-center">
                            No classes scheduled.
                          </div>
                        ) : (
                          dayClasses.map((item) => {
                            const subject = item.academic_subjects
                            const isLab =
                              subject?.subject_type === "Lab" ||
                              subject?.subject_code?.endsWith("L")

                            return (
                              <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex gap-3">
                                  <div className="min-w-[65px] font-mono text-xs">
                                    <p className="font-bold text-slate-900">{item.start_time?.slice(0, 5)}</p>
                                    <p className="text-slate-400 text-[11px]">{item.end_time?.slice(0, 5)}</p>
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
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                          isLab
                                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                                            : "bg-blue-50 text-blue-700 border border-blue-200"
                                        }`}
                                      >
                                        {isLab ? "LAB" : "THEORY"}
                                      </span>
                                    </div>

                                    <p className="mt-1.5 text-[11px] text-slate-500 truncate">
                                      👨‍🏫 {item.teacher_name || "Faculty N/A"} · 📍 {item.room || "Room N/A"}
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
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 mb-3">
                  Laboratory Sessions
                </h3>
                {labs.length === 0 ? (
                  <p className="text-xs text-slate-400">No lab practicals found.</p>
                ) : (
                  <div className="space-y-3">
                    {labs.map((lab) => (
                      <div key={lab.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-xs text-slate-900">{lab.subject_name}</h4>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                            {lab.day_of_week}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {lab.start_time?.slice(0, 5)} - {lab.end_time?.slice(0, 5)} · 📍 {lab.lab_room || "Lab"} · 👨‍🏫 {lab.teacher_name || "Faculty"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Enrolled Courses */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="font-bold text-base text-slate-900 mb-3">
                  Enrolled Subjects ({subjects.length})
                </h3>
                {subjects.length === 0 ? (
                  <p className="text-xs text-slate-400">No courses loaded.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-[10px] font-bold text-blue-600">{sub.subject_code}</p>
                          <p className="text-xs font-bold text-slate-900 truncate">{sub.subject_name}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
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
