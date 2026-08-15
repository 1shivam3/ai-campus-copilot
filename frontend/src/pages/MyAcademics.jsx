import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import {
  getAcademicData,
  getClassSchedule,
} from "../lib/academicData"

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
    "Saturday",
  ]

  useEffect(() => {
    loadAcademicData()
  }, [profile])

  async function loadAcademicData() {
    if (!profile) return

    setLoading(true)
    setError("")

    try {
      const [academicData, scheduleData] =
        await Promise.all([
          getAcademicData(
            profile.semester,
            profile.section
          ),
          getClassSchedule(
            profile.semester,
            profile.section
          ),
        ])

      setSubjects(academicData.subjects)
      setLabs(academicData.labs)
      setSchedule(scheduleData)
    } catch (err) {
      console.error(err)
      setError("Could not load your academic data.")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Page Heading */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600">
              CAMPUS TIMETABLE & SCHEDULE
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Semester {profile?.semester} · Section {profile?.section}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Your class schedule, enrolled subjects, faculty and lab practicals based on Section {profile?.section}.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold tracking-wider text-slate-400">
              TODAY IS
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Loading your academic schedule...
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Today's Classes */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-bold tracking-widest text-blue-600">
                  TODAY
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Today&apos;s Classes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your schedule for today based on Semester {profile?.semester} · Section {profile?.section}.
                </p>
              </div>

              {(() => {
                const today = new Date().toLocaleDateString(
                  "en-US",
                  { weekday: "long" }
                )

                const todaysClasses = schedule
                  .filter((item) => item.day_of_week.toLowerCase() === today.toLowerCase())
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))

                if (todaysClasses.length === 0) {
                  return (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                      <p className="font-semibold text-slate-800">
                        No classes scheduled today 🎉
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        You have no scheduled classes for {today}. Use this time to work on assignments or focus study!
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="grid gap-4 md:grid-cols-2">
                    {todaysClasses.map((item, index) => {
                      const subject = item.academic_subjects
                      const isNext = index === 0

                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border p-5 shadow-sm transition ${
                            isNext
                              ? "border-blue-300 bg-blue-50/50 shadow-md"
                              : "border-slate-200/80 bg-white"
                          }`}
                        >
                          {isNext && (
                            <div className="mb-3 flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                              <p className="text-xs font-bold tracking-widest text-blue-600">
                                NEXT CLASS
                              </p>
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-blue-600">
                                {subject?.subject_code || "CLASS"}
                              </p>

                              <h3 className="mt-1 text-lg font-bold text-slate-900">
                                {subject?.subject_name || "Unknown Subject"}
                              </h3>
                            </div>

                            <div className="text-right font-mono">
                              <p className="text-sm font-bold text-slate-900">
                                {item.start_time?.slice(0, 5)}
                              </p>

                              <p className="text-xs text-slate-400">
                                to {item.end_time?.slice(0, 5)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                              👨‍🏫 {item.teacher_name || "Faculty N/A"}
                            </span>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                              📍 Room {item.room || "—"}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </section>

            {/* Weekly Timetable - Day-by-Day Schedule */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-xs font-bold tracking-widest text-slate-500">
                  WEEKLY SCHEDULE
                </p>

                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Your Class Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Every class from your section&apos;s timetable, including lecture and practical sessions.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {days.map((day) => {
                  const dayClasses = schedule
                    .filter((item) => item.day_of_week.toLowerCase() === day.toLowerCase())
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))

                  return (
                    <div
                      key={day}
                      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition"
                    >
                      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">
                          {day}
                        </h3>

                        <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {dayClasses.length} {dayClasses.length === 1 ? "class" : "classes"}
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {dayClasses.length === 0 ? (
                          <div className="p-6 text-sm text-slate-400">
                            No classes scheduled.
                          </div>
                        ) : (
                          dayClasses.map((item) => {
                            const subject = item.academic_subjects
                            const isLab =
                              subject?.subject_type === "Lab" ||
                              subject?.subject_code?.endsWith("L")

                            return (
                              <div
                                key={item.id}
                                className="p-5 hover:bg-slate-50/50 transition-colors"
                              >
                                <div className="flex gap-4">
                                  <div className="min-w-[72px] font-mono">
                                    <p className="text-sm font-bold text-slate-900">
                                      {item.start_time?.slice(0, 5)}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-400">
                                      {item.end_time?.slice(0, 5)}
                                    </p>
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-bold text-blue-600">
                                          {subject?.subject_code || "CLASS"}
                                        </p>

                                        <h4 className="mt-1 font-bold text-slate-900 leading-snug">
                                          {subject?.subject_name || "Unknown Subject"}
                                        </h4>
                                      </div>

                                      <span
                                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                          isLab
                                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                                            : "bg-blue-50 text-blue-700 border border-blue-200"
                                        }`}
                                      >
                                        {isLab ? "LAB" : "THEORY"}
                                      </span>
                                    </div>

                                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                                      <p className="truncate">
                                        👨‍🏫 {item.teacher_name || "Faculty not assigned"}
                                      </p>

                                      <p>
                                        📍 Room {item.room || "Not assigned"}
                                      </p>
                                    </div>
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

            {/* Labs & Practical Sessions */}
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Lab & Practical Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Dedicated laboratory sessions for Section {profile?.section}
                </p>
              </div>

              {labs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  No lab schedule available.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {labs.map((lab) => (
                    <div
                      key={lab.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition"
                    >
                      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-100">
                        LAB SESSION
                      </span>

                      <h3 className="mt-3 text-lg font-bold text-slate-900">
                        {lab.subject_name}
                      </h3>

                      <div className="mt-4 space-y-2 text-sm border-t border-slate-100 pt-3">
                        <p className="flex justify-between">
                          <span className="text-slate-500">
                            Day
                          </span>
                          <span className="font-semibold text-slate-800">
                            {lab.day_of_week}
                          </span>
                        </p>

                        <p className="flex justify-between">
                          <span className="text-slate-500">
                            Time
                          </span>
                          <span className="font-mono text-xs font-medium text-slate-700">
                            {lab.start_time?.slice(0, 5)} – {lab.end_time?.slice(0, 5)}
                          </span>
                        </p>

                        <p className="flex justify-between">
                          <span className="text-slate-500">
                            Lab Room
                          </span>
                          <span className="font-semibold text-slate-800">
                            {lab.lab_room || "Not assigned"}
                          </span>
                        </p>

                        <p className="flex justify-between">
                          <span className="text-slate-500">
                            Faculty
                          </span>
                          <span className="font-semibold text-slate-800">
                            {lab.teacher_name || "Not assigned"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Enrolled Subjects */}
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Enrolled Subjects
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Courses and faculty assigned to Section {profile?.section}
                </p>
              </div>

              {subjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  No subject data has been added for this section yet.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 border border-blue-100">
                          {subject.subject_code || "COURSE"}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {subject.subject_type || "Theory"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-slate-900">
                        {subject.subject_name}
                      </h3>

                      <div className="mt-5 space-y-2 text-sm border-t border-slate-100 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Faculty
                          </span>

                          <span className="font-semibold text-slate-800">
                            {subject.teacher_name || "Not assigned"}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            Room
                          </span>

                          <span className="font-semibold text-slate-800">
                            {subject.room || "Not assigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

      </div>
    </div>
  )
}

export default MyAcademics
