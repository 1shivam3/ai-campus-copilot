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

        <div className="mb-8">
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

        {loading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Loading your academic timetable and labs...
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Subjects */}
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
                <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">
                  No subject data has been registered for this section yet.
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

            {/* Weekly timetable */}
            <section className="mt-10">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Weekly Class Timetable
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Scheduled lecture periods for Section {profile?.section}
                </p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50">
                      <th className="px-5 py-4 text-left font-semibold text-slate-700">
                        Day
                      </th>

                      <th className="px-5 py-4 text-left font-semibold text-slate-700">
                        Subject
                      </th>

                      <th className="px-5 py-4 text-left font-semibold text-slate-700">
                        Time
                      </th>

                      <th className="px-5 py-4 text-left font-semibold text-slate-700">
                        Faculty
                      </th>

                      <th className="px-5 py-4 text-left font-semibold text-slate-700">
                        Room
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {schedule.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          No timetable entries scheduled yet.
                        </td>
                      </tr>
                    ) : (
                      schedule.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {item.day_of_week}
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-900">
                            {item.academic_subjects?.subject_name ||
                              "Unknown Course"}
                          </td>

                          <td className="px-5 py-4 text-slate-600 font-mono text-xs">
                            {item.start_time?.slice(0, 5)} – {item.end_time?.slice(0, 5)}
                          </td>

                          <td className="px-5 py-4 text-slate-700">
                            {item.teacher_name || "—"}
                          </td>

                          <td className="px-5 py-4 text-slate-700 font-medium">
                            {item.room || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Labs */}
            <section className="mt-10">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900">
                  Lab & Practical Schedule
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Practical laboratory sessions for Section {profile?.section}
                </p>
              </div>

              {labs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">
                  No lab sessions scheduled for this section.
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
          </>
        )}

      </div>
    </div>
  )
}

export default MyAcademics
