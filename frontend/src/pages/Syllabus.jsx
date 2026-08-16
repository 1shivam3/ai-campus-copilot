import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import {
  saveAcademicSubjects,
  getCachedAcademicSubjects,
  saveSyllabusTopics,
  getCachedSyllabusTopics,
} from "../lib/offlineDb"

function Syllabus({ profile }) {
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

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
    loadSubjects()
  }, [profile])

  async function loadSubjects() {
    if (!profile) return

    setLoading(true)
    setError("")

    const cachedSubjects = await getCachedAcademicSubjects(profile.semester, profile.section)
    if (cachedSubjects && cachedSubjects.length > 0) {
      setSubjects(cachedSubjects)
      setSelectedSubject(String(cachedSubjects[0].id))
      loadTopics(cachedSubjects[0].id)
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("academic_subjects")
        .select("id, subject_code, subject_name, subject_type, teacher_name")
        .eq("semester", profile.semester)
        .eq("section", profile.section)
        .order("subject_name")

      if (error) throw error

      if (data && data.length > 0) {
        setSubjects(data)
        saveAcademicSubjects(profile.semester, profile.section, data)
        if (!selectedSubject) {
          setSelectedSubject(String(data[0].id))
          loadTopics(data[0].id)
        }
      }
    } catch (err) {
      console.warn("[Syllabus] Online subjects fetch notice:", err)
      if (!cachedSubjects || cachedSubjects.length === 0) {
        setError("Could not load subjects.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTopics(subjectId) {
    if (!subjectId) {
      setTopics([])
      return
    }

    setTopicsLoading(true)
    setError("")

    const cachedTopics = await getCachedSyllabusTopics(subjectId)
    if (cachedTopics && cachedTopics.length > 0) {
      setTopics(cachedTopics)
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setTopicsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("syllabus_topics")
        .select("*")
        .eq("subject_id", Number(subjectId))
        .order("unit_number")
        .order("id")

      if (error) throw error

      if (data && data.length > 0) {
        setTopics(data)
        saveSyllabusTopics(subjectId, data)
      }
    } catch (err) {
      console.warn("[Syllabus] Online topics fetch notice:", err)
      if (!cachedTopics || cachedTopics.length === 0) {
        setError("Could not load syllabus topics.")
      }
    } finally {
      setTopicsLoading(false)
    }
  }

  function handleSubjectChange(e) {
    const value = e.target.value
    setSelectedSubject(value)
    loadTopics(value)
  }

  const groupedTopics = topics.reduce(
    (groups, topic) => {
      const unit = topic.unit_number || 1

      if (!groups[unit]) {
        groups[unit] = []
      }

      groups[unit].push(topic)

      return groups
    },
    {}
  )

  const selectedSubjectData = subjects.find(
    (subject) =>
      String(subject.id) === selectedSubject
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-blue-600">
            SYLLABUS & CURRICULUM
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Semester {profile?.semester} Syllabus
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Section {profile?.section} · Select a subject to explore its units, key topics, and curriculum outline.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Loading enrolled subjects...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Choose Subject
              </label>

              <select
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
              >
                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                  >
                    {subject.subject_code} — {subject.subject_name} ({subject.subject_type || "Theory"})
                  </option>
                ))}
              </select>
            </div>

            {selectedSubjectData && (
              <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30">
                    {selectedSubjectData.subject_code}
                  </span>

                  <span className="text-xs text-slate-400">
                    Faculty: {selectedSubjectData.teacher_name || "Faculty Assigned"}
                  </span>
                </div>

                <h2 className="mt-3 text-2xl font-bold">
                  {selectedSubjectData.subject_name}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Semester {profile?.semester} · Section {profile?.section} Curriculum Outline
                </p>
              </div>
            )}

            <div className="mt-6">
              {topicsLoading ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  Loading syllabus units...
                </div>
              ) : Object.keys(groupedTopics).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="font-semibold text-slate-800">
                    No syllabus topics registered for this subject
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Detailed unit-by-unit syllabus data has not been added for this subject yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTopics).map(
                    ([unit, unitTopics]) => (
                      <section
                        key={unit}
                        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                      >
                        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-xs font-bold tracking-widest text-blue-600">
                              UNIT {unit}
                            </p>

                            <h3 className="mt-1 text-xl font-bold text-slate-900">
                              Unit {unit}
                            </h3>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {unitTopics.length} {unitTopics.length === 1 ? "topic" : "topics"}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {unitTopics.map((topic) => (
                            <div
                              key={topic.id}
                              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50"
                            >
                              <p className="font-bold text-slate-900">
                                {topic.topic_name}
                              </p>

                              {topic.description && (
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                  {topic.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  )}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}

export default Syllabus
