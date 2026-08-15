import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import TopicQuiz from "./TopicQuiz"
import { SkeletonCard, SkeletonList } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function Progress({ profile, user }) {
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState("")
  const [topics, setTopics] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [quizTopic, setQuizTopic] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    loadSubjects()
  }, [profile])

  async function loadSubjects() {
    if (!profile) return

    setLoading(true)
    setError("")

    try {
      const { data, error: subErr } = await supabase
        .from("academic_subjects")
        .select("id, subject_code, subject_name")
        .eq("semester", profile.semester)
        .eq("section", profile.section)
        .order("subject_name")

      if (subErr) throw subErr

      setSubjects(data || [])

      if (data?.length > 0) {
        const firstSubject = String(data[0].id)
        setSelectedSubject(firstSubject)
        await loadTopics(firstSubject)
      }
    } catch (err) {
      console.error(err)
      setError("Could not load semester subjects.")
    } finally {
      setLoading(false)
    }
  }

  async function loadTopics(subjectId) {
    if (!subjectId) {
      setTopics([])
      setProgress({})
      return
    }

    setTopicsLoading(true)
    setError("")

    try {
      const { data: topicData, error: topicError } = await supabase
        .from("syllabus_topics")
        .select("id, subject_id, unit_number, topic_name, description")
        .eq("subject_id", Number(subjectId))
        .order("unit_number")
        .order("id")

      if (topicError) throw topicError

      setTopics(topicData || [])
      const topicIds = (topicData || []).map((t) => t.id)
      const progressMap = {}

      if (topicIds.length > 0 && user?.id) {
        const { data: pData } = await supabase
          .from("student_topic_progress")
          .select("id, syllabus_topic_id, status, mastery_score")
          .eq("user_id", user.id)
          .in("syllabus_topic_id", topicIds)

        if (pData) {
          pData.forEach((item) => {
            progressMap[item.syllabus_topic_id] = item
          })
        }
      }

      setProgress(progressMap)
    } catch (err) {
      console.error("Topic load error:", err)
      setError("Could not load syllabus topics.")
    } finally {
      setTopicsLoading(false)
    }
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

    // Optimistic UI update
    setProgress((current) => ({
      ...current,
      [topic.id]: {
        ...(current[topic.id] || {}),
        syllabus_topic_id: topic.id,
        status,
        mastery_score: masteryScore,
      },
    }))

    try {
      const { data, error: upErr } = await supabase
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
            onConflict: "user_id,syllabus_topic_id",
          }
        )
        .select()
        .maybeSingle()

      if (upErr) throw upErr
      if (data) {
        setProgress((curr) => ({ ...curr, [topic.id]: data }))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSavingId(null)
    }
  }

  const overallMastery = useMemo(() => {
    if (!topics.length) return 0
    const total = topics.reduce(
      (sum, topic) => sum + Number(progress[topic.id]?.mastery_score || 0),
      0
    )
    return Math.round(total / topics.length)
  }, [topics, progress])

  const groupedTopics = useMemo(() => {
    return topics.reduce((groups, topic) => {
      const unit = topic.unit_number || 1
      if (!groups[unit]) groups[unit] = []
      groups[unit].push(topic)
      return groups
    }, {})
  }, [topics])

  const selectedSubjectData = subjects.find(
    (subject) => String(subject.id) === selectedSubject
  )

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
            SYLLABUS PROGRESSION
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Subject Mastery & Topic Status
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Self-assess unit topics or take AI tests to build a realistic academic mastery model.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={loadSubjects} />
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-3">
            <SkeletonCard className="lg:col-span-2" />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* Controls & Overall Gauge */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm lg:col-span-2">
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Select Course
                </label>

                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedSubject(val)
                    loadTopics(val)
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.subject_code} — {subject.subject_name}
                    </option>
                  ))}
                </select>

                {selectedSubjectData && (
                  <p className="mt-3 text-xs text-slate-500 font-medium">
                    Enrolled course for Semester {profile?.semester} ({profile?.section})
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-xl flex flex-col justify-between">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                    SUBJECT MASTERY
                  </p>
                  <p className="mt-2 text-4xl font-bold text-white">{overallMastery}%</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                      style={{ width: `${overallMastery}%` }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Calculated from {topics.length} recorded topics
                </p>
              </div>
            </div>

            {/* Units & Topics List */}
            <div className="mt-8">
              {topicsLoading ? (
                <SkeletonList count={5} />
              ) : topics.length === 0 ? (
                <EmptyState
                  icon="📖"
                  title="No syllabus topics recorded"
                  description="Topics for this subject have not been populated yet."
                />
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTopics).map(([unit, unitTopics]) => (
                    <section
                      key={unit}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm"
                    >
                      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                            UNIT {unit}
                          </p>
                          <h2 className="text-lg font-bold text-slate-900">
                            Unit {unit} Curricula
                          </h2>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {unitTopics.length} topics
                        </span>
                      </div>

                      <div className="space-y-3.5">
                        {unitTopics.map((topic) => {
                          const current = progress[topic.id]
                          const status = current?.status || "not_started"
                          const mastery = Number(current?.mastery_score || 0)

                          return (
                            <div
                              key={topic.id}
                              className={`rounded-2xl border p-4 sm:p-5 transition ${
                                status === "mastered"
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : status === "learning"
                                    ? "border-amber-200 bg-amber-50/40"
                                    : "border-slate-100 bg-slate-50/70"
                              }`}
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-3xl flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
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
                                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                                      {topic.description}
                                    </p>
                                  )}

                                  <div className="mt-3.5 max-w-md">
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                      <span className="font-medium text-slate-500">
                                        Mastery
                                      </span>
                                      <span className="font-bold text-slate-900">
                                        {mastery}%
                                      </span>
                                    </div>

                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                                      <div
                                        className={`h-full transition-all duration-500 ${
                                          status === "mastered"
                                            ? "bg-emerald-500"
                                            : status === "learning"
                                              ? "bg-amber-500"
                                              : "bg-slate-400"
                                        }`}
                                        style={{ width: `${mastery}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                                  {[
                                    ["not_started", "Not Started"],
                                    ["learning", "Learning"],
                                    ["mastered", "Mastered"],
                                  ].map(([value, label]) => (
                                    <button
                                      key={value}
                                      disabled={savingId === topic.id}
                                      onClick={() => changeProgress(topic, value)}
                                      className={`rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98] ${
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
                                  ))}

                                  <button
                                    onClick={() => setQuizTopic(topic)}
                                    className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-sm active:scale-[0.98]"
                                  >
                                    Test Yourself 🎯
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {/* Topic Quiz Modal */}
            {quizTopic && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-xs flex items-center justify-center">
                <div className="w-full max-w-3xl my-8">
                  <TopicQuiz
                    topic={quizTopic}
                    user={user}
                    onComplete={() => loadTopics(selectedSubject)}
                    onClose={() => setQuizTopic(null)}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Progress
