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
  }, [profile?.semester, profile?.section])

  async function loadSubjects() {
    if (!profile) return

    setLoading(true)
    setError("")

    // 1. Try Cached Subjects First
    const cachedSubjects = await getCachedAcademicSubjects(profile.semester, profile.section)
    if (cachedSubjects && cachedSubjects.length > 0) {
      // Filter only subjects that have syllabus
      setSubjects(cachedSubjects)
      if (!selectedSubject || !cachedSubjects.some((s) => String(s.id) === selectedSubject)) {
        setSelectedSubject(String(cachedSubjects[0].id))
        loadTopics(cachedSubjects[0].id)
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false)
      return
    }

    // 2. Fetch Active Syllabus Subjects from Supabase
    try {
      const { data, error } = await supabase
        .from("academic_subjects")
        .select(`
          id,
          subject_code,
          subject_name,
          subject_type,
          teacher_name,
          syllabus_topics!inner(id)
        `)
        .eq("semester", profile.semester)
        .eq("section", profile.section)
        .order("subject_code")

      if (error) throw error

      if (data && data.length > 0) {
        // Deduplicate subjects by ID
        const uniqueSubjects = []
        const seen = new Set()
        for (const sub of data) {
          if (!seen.has(sub.id)) {
            seen.add(sub.id)
            uniqueSubjects.push({
              id: sub.id,
              subject_code: sub.subject_code,
              subject_name: sub.subject_name,
              subject_type: sub.subject_type || (sub.subject_code?.endsWith("L") ? "Lab" : "Theory"),
              teacher_name: sub.teacher_name,
            })
          }
        }

        setSubjects(uniqueSubjects)
        saveAcademicSubjects(profile.semester, profile.section, uniqueSubjects)

        if (!selectedSubject || !uniqueSubjects.some((s) => String(s.id) === selectedSubject)) {
          setSelectedSubject(String(uniqueSubjects[0].id))
          loadTopics(uniqueSubjects[0].id)
        }
      } else {
        setSubjects([])
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

    // 1. Try Cached Topics First
    const cachedTopics = await getCachedSyllabusTopics(subjectId)
    if (cachedTopics && cachedTopics.length > 0) {
      setTopics(cachedTopics)
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setTopicsLoading(false)
      return
    }

    // 2. Fetch Topics from Supabase
    try {
      const { data, error } = await supabase
        .from("syllabus_topics")
        .select("*")
        .eq("subject_id", Number(subjectId))
        .order("unit_number", { ascending: true })
        .order("id", { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setTopics(data)
        saveSyllabusTopics(subjectId, data)
      } else {
        setTopics([])
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

  const selectedSubjectData = subjects.find(
    (subject) => String(subject.id) === selectedSubject
  )

  const isLabSubject =
    selectedSubjectData?.subject_type?.toLowerCase() === "lab" ||
    selectedSubjectData?.subject_code?.endsWith("L")

  // For Theory: group by unit_number
  const groupedUnits = !isLabSubject
    ? topics.reduce((groups, topic) => {
        const unit = topic.unit_number || 1
        if (!groups[unit]) {
          groups[unit] = []
        }
        groups[unit].push(topic)
        return groups
      }, {})
    : {}

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest uppercase text-blue-600">
                Academic Curriculum
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60">
                {subjects.length} subjects available
              </span>
            </div>

            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Semester {profile?.semester} Syllabus
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Section {profile?.section} · Select an active subject below to view its units or practical curriculum.
            </p>
          </div>

          {!isOnline && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 self-start">
              Offline Mode · Showing Cached Syllabus
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-xs">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
            <p>Loading available syllabus subjects...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-red-50 p-6 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <h3 className="text-base font-bold text-slate-800">No active syllabus found</h3>
            <p className="mt-1 text-xs text-slate-500">
              No syllabus data has been imported for Semester {profile?.semester} Section {profile?.section}.
            </p>
          </div>
        ) : (
          <>
            {/* Subject Selector & Quick Badges */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Subject ({subjects.length} available)
                </label>

                <select
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 transition"
                >
                  {subjects.map((sub) => {
                    const isLab = sub.subject_type?.toLowerCase() === "lab" || sub.subject_code?.endsWith("L")
                    return (
                      <option key={sub.id} value={sub.id}>
                        {sub.subject_code} — {sub.subject_name} [{isLab ? "LAB" : "THEORY"}]
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Quick Subject Pills */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                {subjects.map((sub) => {
                  const isSelected = String(sub.id) === selectedSubject
                  const isLab = sub.subject_type?.toLowerCase() === "lab" || sub.subject_code?.endsWith("L")

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setSelectedSubject(String(sub.id))
                        loadTopics(sub.id)
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span>{sub.subject_code}</span>
                      <span
                        className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase tracking-wide ${
                          isSelected
                            ? isLab
                              ? "bg-emerald-400/20 text-emerald-200"
                              : "bg-blue-400/20 text-blue-200"
                            : isLab
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isLab ? "LAB" : "THEORY"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Selected Subject Header Card */}
            {selectedSubjectData && (
              <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 border border-blue-500/30">
                      {selectedSubjectData.subject_code}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border ${
                        isLabSubject
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}
                    >
                      {isLabSubject ? "LAB" : "THEORY"}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    Faculty: {selectedSubjectData.teacher_name || "Department Faculty"}
                  </span>
                </div>

                <h2 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight">
                  {selectedSubjectData.subject_name}
                </h2>

                <p className="mt-1 text-xs sm:text-sm text-slate-400">
                  Semester {profile?.semester} · Section {profile?.section} ·{" "}
                  {isLabSubject
                    ? `${topics.length} Practical Experiments`
                    : `${Object.keys(groupedUnits).length} Theory Units (${topics.length} topics)`}
                </p>
              </div>
            )}

            {/* Content Container (Units for Theory, Practicals for Lab) */}
            <div className="mt-6">
              {topicsLoading ? (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-xs">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                  <p>Loading curriculum records...</p>
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="font-bold text-slate-800 text-sm">
                    No syllabus content registered for this subject
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Detailed syllabus records have not been imported for this subject yet.
                  </p>
                </div>
              ) : isLabSubject ? (
                /* ======================================================= */
                /* LAB SUBJECT: RENDER PRACTICALS 1..N (NO 4-UNIT FORCING)  */
                /* ======================================================= */
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                      List of Practical Experiments ({topics.length} Total)
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
                      Continuous Lab Evaluation
                    </span>
                  </div>

                  <div className="grid gap-3.5">
                    {topics.map((practical, idx) => {
                      const practicalNum = practical.unit_number || idx + 1

                      return (
                        <div
                          key={practical.id || idx}
                          className="group rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:border-emerald-300 hover:shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60 shrink-0">
                                  PRACTICAL {practicalNum}
                                </span>
                              </div>

                              <h4 className="pt-1 font-bold text-sm sm:text-base text-slate-900 leading-snug">
                                {practical.topic_name}
                              </h4>

                              {practical.description && (
                                <p className="pt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                  {practical.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* ======================================================= */
                /* THEORY SUBJECT: RENDER DYNAMIC UNITS & OUTLINES         */
                /* ======================================================= */
                <div className="space-y-6">
                  {Object.entries(groupedUnits).map(([unitNum, unitTopics]) => (
                    <section
                      key={unitNum}
                      className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs"
                    >
                      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[11px] font-bold tracking-widest uppercase text-blue-600">
                            UNIT {unitNum}
                          </span>
                          <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                            Unit {unitNum}
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
                            className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50"
                          >
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                              {topic.topic_name}
                            </h4>

                            {topic.description && (
                              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                                {topic.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
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
