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
    <div className="min-h-screen bg-[#F7F7F2] p-4 sm:p-6 lg:p-8 dark:bg-[#0f1416]">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E4E4E7] pb-5 dark:border-[#27343a]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase text-[#0F766E] dark:text-[#2DD4BF]">
                Academic Curriculum
              </span>
              <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                {subjects.length} subjects available
              </span>
            </div>

            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B] dark:text-[#f4f4f5]">
              Semester {profile?.semester} Syllabus
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-[#52525B] font-normal dark:text-[#a1a1aa]">
              Section {profile?.section} · Select an active subject below to view its units or practical curriculum.
            </p>
          </div>

          {!isOnline && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-[#D97706] self-start">
              Offline Mode · Showing Cached Syllabus
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-[#E4E4E7] bg-white p-8 text-center text-sm font-medium text-[#52525B] shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#0F766E] border-t-transparent mb-2" />
            <p>Loading available syllabus subjects...</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-rose-50 p-6 text-sm text-[#DC2626] border border-rose-200">
            {error}
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#E4E4E7] bg-white p-12 text-center dark:border-[#27343a] dark:bg-[#141c1f]">
            <h3 className="text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">No active syllabus found</h3>
            <p className="mt-1 text-xs text-[#52525B] dark:text-[#a1a1aa]">
              No syllabus data has been imported for Semester {profile?.semester} Section {profile?.section}.
            </p>
          </div>
        ) : (
          <>
            {/* Subject Selector & Quick Badges */}
            <div className="rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-6 shadow-2xs space-y-4 dark:border-[#27343a] dark:bg-[#141c1f]">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#71717A] dark:text-[#a1a1aa]">
                  Select Subject ({subjects.length} available)
                </label>

                <select
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  className="w-full rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] px-4 py-3 text-sm font-semibold text-[#18181B] outline-none focus:border-[#0F766E] focus:bg-white focus:ring-2 focus:ring-[#0F766E]/20 transition dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
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
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[#E4E4E7] dark:border-[#27343a]">
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
                          ? "bg-[#18181B] text-white shadow-2xs dark:bg-[#2DD4BF] dark:text-[#0f1416]"
                          : "border border-[#E4E4E7] bg-[#F7F7F2] text-[#52525B] hover:border-[#0F766E]/40 hover:bg-white dark:border-[#27343a] dark:bg-[#182226] dark:text-[#a1a1aa]"
                      }`}
                    >
                      <span>{sub.subject_code}</span>
                      <span
                        className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase tracking-wide ${
                          isSelected
                            ? isLab
                              ? "bg-emerald-400/20 text-emerald-200"
                              : "bg-teal-400/20 text-teal-200"
                            : isLab
                            ? "bg-[#ECFDF5] text-[#0F766E] dark:bg-[#141c1f] dark:text-[#2DD4BF]"
                            : "bg-zinc-100 text-[#52525B] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
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
              <div className="rounded-3xl bg-[#12312F] p-6 text-white shadow-xs md:p-8 dark:bg-[#141c1f] dark:border dark:border-[#27343a]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold text-[#2DD4BF] border border-teal-500/30">
                      {selectedSubjectData.subject_code}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border ${
                        isLabSubject
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-teal-500/20 text-[#2DD4BF] border-teal-500/30"
                      }`}
                    >
                      {isLabSubject ? "LAB" : "THEORY"}
                    </span>
                  </div>

                  <span className="text-xs text-[#A1A1AA] font-medium">
                    Faculty: {selectedSubjectData.teacher_name || "Department Faculty"}
                  </span>
                </div>

                <h2 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight">
                  {selectedSubjectData.subject_name}
                </h2>

                <p className="mt-1 text-xs sm:text-sm text-[#A1A1AA]">
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
                <div className="rounded-3xl border border-[#E4E4E7] bg-white p-8 text-center text-sm font-medium text-[#52525B] shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#0F766E] border-t-transparent mb-2" />
                  <p>Loading curriculum records...</p>
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[#E4E4E7] bg-white p-8 text-center dark:border-[#27343a] dark:bg-[#141c1f]">
                  <p className="font-bold text-[#18181B] text-sm dark:text-[#f4f4f5]">
                    No syllabus content registered for this subject
                  </p>
                  <p className="mt-1 text-xs text-[#52525B] dark:text-[#a1a1aa]">
                    Detailed syllabus records have not been imported for this subject yet.
                  </p>
                </div>
              ) : isLabSubject ? (
                /* ======================================================= */
                /* LAB SUBJECT: RENDER PRACTICALS 1..N (NO 4-UNIT FORCING)  */
                /* ======================================================= */
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#a1a1aa]">
                      List of Practical Experiments ({topics.length} Total)
                    </h3>
                    <span className="text-xs text-[#71717A] font-medium dark:text-[#a1a1aa]">
                      Continuous Lab Evaluation
                    </span>
                  </div>

                  <div className="grid gap-3.5">
                    {topics.map((practical, idx) => {
                      const practicalNum = practical.unit_number || idx + 1

                      return (
                        <div
                          key={practical.id || idx}
                          className="group rounded-2xl border border-[#E4E4E7] bg-white p-5 transition hover:border-[#0F766E]/40 hover:shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-lg bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-bold text-[#0F766E] border border-teal-200/60 shrink-0 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                                  PRACTICAL {practicalNum}
                                </span>
                              </div>

                              <h4 className="pt-1 font-bold text-sm sm:text-base text-[#18181B] leading-snug dark:text-[#f4f4f5]">
                                {practical.topic_name}
                              </h4>

                              {practical.description && (
                                <p className="pt-1.5 text-xs sm:text-sm text-[#52525B] leading-relaxed dark:text-[#a1a1aa]">
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
                      className="rounded-3xl border border-[#E4E4E7] bg-white p-5 sm:p-6 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]"
                    >
                      <div className="mb-4 flex items-center justify-between border-b border-[#E4E4E7] pb-3 dark:border-[#27343a]">
                        <div>
                          <span className="text-[11px] font-bold tracking-widest uppercase text-[#0F766E] dark:text-[#2DD4BF]">
                            UNIT {unitNum}
                          </span>
                          <h3 className="mt-0.5 text-lg font-bold text-[#18181B] dark:text-[#f4f4f5]">
                            Unit {unitNum}
                          </h3>
                        </div>

                        <span className="rounded-full bg-[#F7F7F2] px-3 py-1 text-xs font-semibold text-[#52525B] border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
                          {unitTopics.length} {unitTopics.length === 1 ? "topic" : "topics"}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {unitTopics.map((topic) => (
                          <div
                            key={topic.id}
                            className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 transition hover:bg-white dark:border-[#27343a] dark:bg-[#182226] dark:hover:bg-[#1e2c31]"
                          >
                            <h4 className="font-bold text-xs sm:text-sm text-[#18181B] dark:text-[#f4f4f5]">
                              {topic.topic_name}
                            </h4>

                            {topic.description && (
                              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#52525B] dark:text-[#a1a1aa]">
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
