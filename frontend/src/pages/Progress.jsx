import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function Progress({ user, profile }) {
  const [subjects, setSubjects] = useState([])
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [topics, setTopics] = useState([])
  const [progressMap, setProgressMap] = useState({}) // syllabus_topic_id -> { status, mastery_score }
  const [loading, setLoading] = useState(true)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [savingTopicId, setSavingTopicId] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadSubjects()
  }, [profile])

  async function loadSubjects() {
    if (!profile) return

    setLoading(true)
    setError("")

    const { data, error } = await supabase
      .from("academic_subjects")
      .select("id, subject_code, subject_name, subject_type, teacher_name")
      .eq("semester", profile.semester)
      .eq("section", profile.section)
      .order("subject_name")

    if (error) {
      console.error(error)
      setError("Could not load subjects.")
    } else {
      setSubjects(data || [])
      if (data?.length > 0) {
        setSelectedSubjectId(String(data[0].id))
        loadTopicsAndProgress(data[0].id)
      }
    }

    setLoading(false)
  }

  async function loadTopicsAndProgress(subjectId) {
    if (!subjectId || !user?.id) {
      setTopics([])
      return
    }

    setTopicsLoading(true)
    setError("")

    try {
      const [topicsRes, progressRes] = await Promise.all([
        supabase
          .from("syllabus_topics")
          .select("*")
          .eq("subject_id", Number(subjectId))
          .order("unit_number")
          .order("id"),
        supabase
          .from("student_topic_progress")
          .select("*")
          .eq("user_id", user.id),
      ])

      if (topicsRes.error) {
        throw topicsRes.error
      }

      setTopics(topicsRes.data || [])

      const map = {}
      if (progressRes.data) {
        progressRes.data.forEach((row) => {
          map[row.syllabus_topic_id] = {
            status: row.status,
            mastery_score: Number(row.mastery_score) || 0,
          }
        })
      }
      setProgressMap(map)
    } catch (err) {
      console.error("Progress load error:", err)
      setError("Could not load syllabus or student progress data.")
    }

    setTopicsLoading(false)
  }

  function handleSubjectChange(e) {
    const val = e.target.value
    setSelectedSubjectId(val)
    loadTopicsAndProgress(val)
  }

  async function updateTopicProgress(topicId, newStatus, newScore) {
    if (!user?.id) return

    setSavingTopicId(topicId)

    // Optimistic UI update
    setProgressMap((prev) => ({
      ...prev,
      [topicId]: {
        status: newStatus,
        mastery_score: newScore,
      },
    }))

    try {
      const { error } = await supabase.from("student_topic_progress").upsert(
        {
          user_id: user.id,
          syllabus_topic_id: topicId,
          status: newStatus,
          mastery_score: newScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, syllabus_topic_id" }
      )

      if (error) {
        console.error("Failed to save progress:", error)
      }
    } catch (err) {
      console.error("Update error:", err)
    }

    setSavingTopicId(null)
  }

  const groupedTopics = topics.reduce((groups, topic) => {
    const unit = topic.unit_number || 1
    if (!groups[unit]) {
      groups[unit] = []
    }
    groups[unit].push(topic)
    return groups
  }, {})

  const selectedSubjectData = subjects.find(
    (s) => String(s.id) === selectedSubjectId
  )

  // Calculate overall subject mastery
  const totalTopics = topics.length
  const masteredCount = topics.filter(
    (t) => progressMap[t.id]?.status === "mastered"
  ).length
  const learningCount = topics.filter(
    (t) => progressMap[t.id]?.status === "learning"
  ).length
  const totalScore = topics.reduce(
    (sum, t) => sum + (progressMap[t.id]?.mastery_score || 0),
    0
  )
  const averageMastery = totalTopics > 0 ? Math.round(totalScore / totalTopics) : 0

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600">
              ACADEMIC MASTERY TRACKER
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Subject Progress & Mastery
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Mark topics as you learn them to help the AI Copilot target your revision accurately.
            </p>
          </div>

          {selectedSubjectData && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm min-w-[200px]">
              <p className="text-xs font-semibold text-slate-400">
                OVERALL SUBJECT MASTERY
              </p>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">
                  {averageMastery}%
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {masteredCount}/{totalTopics} mastered
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${averageMastery}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Loading subjects...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        ) : (
          <>
            {/* Subject Selector */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Select Course
              </label>

              <select
                value={selectedSubjectId}
                onChange={handleSubjectChange}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.subject_code} — {subject.subject_name} ({subject.subject_type || "Theory"})
                  </option>
                ))}
              </select>
            </div>

            {/* Course Summary Banner */}
            {selectedSubjectData && (
              <div className="mt-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300 border border-blue-500/30">
                    {selectedSubjectData.subject_code}
                  </span>

                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span>🟢 {masteredCount} Mastered</span>
                    <span>🟡 {learningCount} Learning</span>
                    <span>⚪ {totalTopics - masteredCount - learningCount} Not Started</span>
                  </div>
                </div>

                <h2 className="mt-3 text-2xl font-bold">
                  {selectedSubjectData.subject_name}
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  Semester {profile?.semester} · Section {profile?.section} · {totalTopics} syllabus units & modules
                </p>
              </div>
            )}

            {/* Unit & Topic List */}
            <div className="mt-6">
              {topicsLoading ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  Loading syllabus topics and mastery scores...
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
                  {Object.entries(groupedTopics).map(([unit, unitTopics]) => (
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

                      <div className="space-y-4">
                        {unitTopics.map((topic) => {
                          const progress = progressMap[topic.id] || {
                            status: "not_started",
                            mastery_score: 0,
                          }

                          const isSaving = savingTopicId === topic.id

                          return (
                            <div
                              key={topic.id}
                              className={`rounded-2xl border p-5 transition ${
                                progress.status === "mastered"
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : progress.status === "learning"
                                    ? "border-amber-200 bg-amber-50/40"
                                    : "border-slate-100 bg-slate-50/70"
                              }`}
                            >
                              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900">
                                      {topic.topic_name}
                                    </h4>

                                    {progress.status === "mastered" && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                        MASTERED ({progress.mastery_score}%)
                                      </span>
                                    )}

                                    {progress.status === "learning" && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                        LEARNING ({progress.mastery_score}%)
                                      </span>
                                    )}

                                    {progress.status === "not_started" && (
                                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                        NOT STARTED
                                      </span>
                                    )}
                                  </div>

                                  {topic.description && (
                                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                      {topic.description}
                                    </p>
                                  )}
                                </div>

                                {/* Status Toggle Buttons */}
                                <div className="flex items-center gap-2 self-start shrink-0">
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() =>
                                      updateTopicProgress(topic.id, "not_started", 0)
                                    }
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                      progress.status === "not_started"
                                        ? "bg-slate-800 text-white shadow-sm"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    Not Started
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() =>
                                      updateTopicProgress(
                                        topic.id,
                                        "learning",
                                        progress.mastery_score > 0 ? progress.mastery_score : 50
                                      )
                                    }
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                      progress.status === "learning"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                                    }`}
                                  >
                                    Learning
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() =>
                                      updateTopicProgress(topic.id, "mastered", 100)
                                    }
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                      progress.status === "mastered"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                                    }`}
                                  >
                                    Mastered
                                  </button>
                                </div>
                              </div>

                              {/* Mastery Slider when in Learning status */}
                              {progress.status === "learning" && (
                                <div className="mt-4 border-t border-amber-200/60 pt-3">
                                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                                    <span>Mastery Level: {progress.mastery_score}%</span>
                                    <span className="text-slate-400">Slide to adjust confidence</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="10"
                                    max="90"
                                    step="5"
                                    value={progress.mastery_score || 50}
                                    onChange={(e) =>
                                      updateTopicProgress(
                                        topic.id,
                                        "learning",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="mt-2 w-full accent-amber-600 cursor-pointer"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
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

export default Progress
