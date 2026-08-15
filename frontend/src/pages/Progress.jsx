import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"

function Progress({ profile, user }) {
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [topics, setTopics] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
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
      .select("id, subject_code, subject_name")
      .eq("semester", profile.semester)
      .eq("section", profile.section)
      .order("subject_name")

    if (error) {
      console.error(error)
      setError("Could not load subjects.")
      setLoading(false)
      return
    }

    setSubjects(data || [])

    if (data?.length > 0) {
      const firstSubject = String(data[0].id)
      setSelectedSubject(firstSubject)
      await loadTopics(firstSubject)
    }

    setLoading(false)
  }

  async function loadTopics(subjectId) {
    if (!subjectId) {
      setTopics([])
      setProgress({})
      return
    }

    setTopicsLoading(true)
    setError("")

    const { data: topicData, error: topicError } =
      await supabase
        .from("syllabus_topics")
        .select("*")
        .eq("subject_id", Number(subjectId))
        .order("unit_number")
        .order("id")

    if (topicError) {
      console.error(topicError)
      setError("Could not load syllabus topics.")
      setTopicsLoading(false)
      return
    }

    const topicIds = (topicData || []).map(
      (topic) => topic.id
    )

    let progressData = []

    if (topicIds.length > 0 && user?.id) {
      const { data, error } = await supabase
        .from("student_topic_progress")
        .select("*")
        .eq("user_id", user.id)
        .in("syllabus_topic_id", topicIds)

      if (error) {
        console.error(error)
        setError("Could not load topic progress.")
        setTopicsLoading(false)
        return
      }

      progressData = data || []
    }

    const progressMap = {}

    for (const item of progressData) {
      progressMap[item.syllabus_topic_id] = item
    }

    setTopics(topicData || [])
    setProgress(progressMap)
    setTopicsLoading(false)
  }

  async function changeProgress(topic, status) {
    if (!user?.id) return
    setSavingId(topic.id)
    setError("")

    const masteryByStatus = {
      not_started: 0,
      learning: 50,
      mastered: 100,
    }

    const masteryScore = masteryByStatus[status]

    const { data, error } = await supabase
      .from("student_topic_progress")
      .upsert(
        {
          user_id: user.id,
          syllabus_topic_id: topic.id,
          status,
          mastery_score: masteryScore,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "user_id,syllabus_topic_id",
        }
      )
      .select()
      .single()

    if (error) {
      console.error(error)
      setError("Could not update topic progress.")
      setSavingId(null)
      return
    }

    setProgress((current) => ({
      ...current,
      [topic.id]: data,
    }))

    setSavingId(null)
  }

  const overallMastery = useMemo(() => {
    if (!topics.length) return 0

    const total = topics.reduce((sum, topic) => {
      return (
        sum +
        Number(
          progress[topic.id]?.mastery_score || 0
        )
      )
    }, 0)

    return Math.round(total / topics.length)
  }, [topics, progress])

  const groupedTopics = topics.reduce(
    (groups, topic) => {
      const unit = topic.unit_number || 0

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
      <div className="mx-auto max-w-6xl">

        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-blue-600">
            LEARNING PROGRESS
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Master Your Syllabus
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Track what you have studied so the Copilot can
            understand your actual strengths and weaknesses.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Loading your subjects...
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-5 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-3">

              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
                <p className="text-xs font-bold tracking-widest text-slate-500">
                  SUBJECT
                </p>

                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    const value = e.target.value
                    setSelectedSubject(value)
                    loadTopics(value)
                  }}
                  className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition"
                >
                  {subjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.subject_code} —{" "}
                      {subject.subject_name}
                    </option>
                  ))}
                </select>

                {selectedSubjectData && (
                  <p className="mt-3 text-sm text-slate-500 font-medium">
                    {selectedSubjectData.subject_name}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest text-slate-400">
                    OVERALL MASTERY
                  </p>

                  <p className="mt-2 text-4xl font-bold">
                    {overallMastery}%
                  </p>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{
                        width: `${overallMastery}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Calculated from your declared topic progress.
                </p>
              </div>
            </div>

            <div className="mt-6">
              {topicsLoading ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  Loading topics...
                </div>
              ) : topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <p className="font-semibold text-slate-800">
                    No syllabus topics available
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Add syllabus content for this subject first.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
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

                            <h2 className="mt-1 text-xl font-bold text-slate-900">
                              Unit {unit}
                            </h2>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {unitTopics.length} {unitTopics.length === 1 ? "topic" : "topics"}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {unitTopics.map((topic) => {
                            const current =
                              progress[topic.id]

                            const status =
                              current?.status ||
                              "not_started"

                            const mastery =
                              Number(
                                current?.mastery_score || 0
                              )

                            return (
                              <div
                                key={topic.id}
                                className={`rounded-2xl border p-5 transition ${
                                  status === "mastered"
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : status === "learning"
                                      ? "border-amber-200 bg-amber-50/40"
                                      : "border-slate-100 bg-slate-50/70"
                                }`}
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                                  <div className="max-w-3xl flex-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-bold text-slate-900">
                                        {topic.topic_name}
                                      </h3>

                                      {status === "mastered" && (
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                          MASTERED
                                        </span>
                                      )}

                                      {status === "learning" && (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                          LEARNING
                                        </span>
                                      )}
                                    </div>

                                    {topic.description && (
                                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                                        {topic.description}
                                      </p>
                                    )}

                                    <div className="mt-4">
                                      <div className="mb-1.5 flex items-center justify-between">
                                        <span className="text-xs font-medium text-slate-500">
                                          Topic Mastery
                                        </span>

                                        <span className="text-xs font-bold text-slate-900">
                                          {mastery}%
                                        </span>
                                      </div>

                                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                        <div
                                          className={`h-full transition-all duration-500 ${
                                            status === "mastered"
                                              ? "bg-emerald-500"
                                              : status === "learning"
                                                ? "bg-amber-500"
                                                : "bg-slate-400"
                                          }`}
                                          style={{
                                            width: `${mastery}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 flex-wrap gap-2 self-start">
                                    {[
                                      ["not_started", "Not Started"],
                                      ["learning", "Learning"],
                                      ["mastered", "Mastered"],
                                    ].map(
                                      ([value, label]) => (
                                        <button
                                          key={value}
                                          disabled={
                                            savingId === topic.id
                                          }
                                          onClick={() =>
                                            changeProgress(
                                              topic,
                                              value
                                            )
                                          }
                                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                            status === value
                                              ? value === "mastered"
                                                ? "bg-emerald-600 text-white shadow-sm"
                                                : value === "learning"
                                                  ? "bg-amber-600 text-white shadow-sm"
                                                  : "bg-slate-900 text-white shadow-sm"
                                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                          } disabled:opacity-50`}
                                        >
                                          {label}
                                        </button>
                                      )
                                    )}
                                  </div>

                                </div>
                              </div>
                            )
                          })}
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

export default Progress
