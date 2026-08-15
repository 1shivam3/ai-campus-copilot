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

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600">
              CAMPUS TIMETABLE & SCHEDULE
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Semester {profile?.semester} · Section {profile?.section}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Your weekly class timetable, assigned subjects, faculty and practical labs for Section {profile?.section}.
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
            Loading your academic timetable and schedule...
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
              <div className="mb-4">
                <p className="text-xs font-bold tracking-widest text-blue-600">
                  TODAY
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Today&apos;s Classes
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Lectures scheduled for your section today
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(() => {
                  const today = new Date().toLocaleDateString(
                    "en-US",
                    { weekday: "long" }
                  )

                  const todaysClasses = schedule
                    .filter((item) => item.day_of_week.toLowerCase() === today.toLowerCase())
                    .sort((a, b) =>
                      a.start_time.localeCompare(b.start_time)
                    )

                  if (todaysClasses.length === 0) {
                    return (
                      <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                        🎉 No lectures scheduled for {today}! Enjoy your free study hours.
                      </div>
                    )
                  }

                  return todaysClasses.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold text-blue-600 tracking-wider">
                            {item.academic_subjects?.subject_code || "CLASS"}
                          </p>

                          <h3 className="mt-2 text-lg font-bold text-slate-900">
                            {item.academic_subjects?.subject_name || "Unknown Subject"}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.teacher_name || "Faculty not assigned"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 font-mono">
                            {item.start_time?.slice(0, 5)}
                          </p>

                          <p className="text-xs text-slate-400 font-mono">
                            to {item.end_time?.slice(0, 5)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          Room {item.room || "—"}
                        </span>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {item.academic_subjects?.subject_type || "Theory"}
                        </span>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </section>

            {/* Weekly Timetable */}
            <section className="mb-10">
              <div className="mb-4">
                <p className="text-xs font-bold tracking-widest text-slate-500">
                  WEEKLY SCHEDULE
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Weekly Class Timetable
                </h2>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <table className="min-w-[900px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50">
                      <th className="px-4 py-4 text-left font-semibold text-slate-700">
                        Time
                      </th>

                      {days.map((day) => (
                        <th
                          key={day}
                          className="px-4 py-4 text-left font-semibold text-slate-700"
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {(() => {
                      const timeSlots = [
                        ...new Set(
                          schedule.map(
                            (item) =>
                              `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`
                          )
                        ),
                      ].sort()

                      if (timeSlots.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              No timetable entries registered yet.
                            </td>
                          </tr>
                        )
                      }

                      return timeSlots.map((slot) => {
                        const [start, end] = slot.split("-")

                        return (
                          <tr
                            key={slot}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-500 font-mono text-xs">
                              {start} – {end}
                            </td>

                            {days.map((day) => {
                              const item = schedule.find(
                                (entry) =>
                                  entry.day_of_week.toLowerCase() === day.toLowerCase() &&
                                  entry.start_time.slice(0, 5) === start &&
                                  entry.end_time.slice(0, 5) === end
                              )

                              return (
                                <td
                                  key={day}
                                  className="min-w-[140px] px-4 py-4 align-top"
                                >
                                  {item ? (
                                    <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-3 hover:border-slate-300 transition">
                                      <p className="font-bold text-slate-900 leading-snug">
                                        {item.academic_subjects
                                          ?.subject_name ||
                                          "Unknown"}
                                      </p>

                                      <p className="mt-1 text-xs font-semibold text-blue-600">
                                        {item.academic_subjects
                                          ?.subject_code || ""}
                                      </p>

                                      <p className="mt-2 text-xs text-slate-600 truncate" title={item.teacher_name}>
                                        {item.teacher_name ||
                                          "Faculty N/A"}
                                      </p>

                                      <p className="mt-1 text-xs text-slate-400 font-medium">
                                        Room {item.room || "—"}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">
                                      —
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Labs */}
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Lab & Practical Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Practical laboratory sessions for Section {profile?.section}
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
