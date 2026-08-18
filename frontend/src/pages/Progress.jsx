import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import TopicQuiz from "./TopicQuiz"
import {
  saveAcademicSubjects,
  getCachedAcademicSubjects,
  saveSyllabusTopics,
  getCachedSyllabusTopics,
  saveTopicProgress,
  updateLocalTopicProgress,
  getCachedTopicProgress,
} from "../lib/offlineDb"
import { enqueueOperation } from "../lib/syncQueue"
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)

  useEffect(() => {
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    function handleSyncComplete() {
      if (user?.id && selectedSubject) {
        loadTopics(selectedSubject)
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("coursepilot:sync-complete", handleSyncComplete)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("coursepilot:sync-complete", handleSyncComplete)
    }
  }, [user, selectedSubject])

  useEffect(() => {
    loadSubjects()
  }, [profile])

  async function loadSubjects() {
    if (!profile) return

    setLoading(true)
    setError("")

    const cachedSubs = await getCachedAcademicSubjects(profile.semester, profile.section)
    if (cachedSubs && cachedSubs.length > 0) {
      setSubjects(cachedSubs)
      const firstId = String(cachedSubs[0].id)
      setSelectedSubject(firstId)
      loadTopics(firstId)
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false)
      return
    }

    try {
      const { data, error: subErr } = await supabase
        .from("academic_subjects")
        .select("id, subject_code, subject_name")
        .eq("semester", profile.semester)
        .eq("section", profile.section)
        .order("subject_name")

      if (subErr) throw subErr

      if (data && data.length > 0) {
        setSubjects(data)
        saveAcademicSubjects(profile.semester, profile.section, data)
        if (!selectedSubject) {
          const firstSubject = String(data[0].id)
          setSelectedSubject(firstSubject)
          await loadTopics(firstSubject)
        }
      }
    } catch (err) {
      console.warn("[Progress] Subjects online query notice:", err)
      if (!cachedSubs || cachedSubs.length === 0) {
        setError("Could not load semester subjects.")
      }
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

    // 1. Instant Cache Load
    const cachedTopics = await getCachedSyllabusTopics(subjectId)
    if (cachedTopics && cachedTopics.length > 0) {
      setTopics(cachedTopics)
      if (user?.id) {
        const topicIds = cachedTopics.map((t) => t.id)
        const cachedProgress = await getCachedTopicProgress(user.id, topicIds)
        setProgress(cachedProgress)
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setTopicsLoading(false)
      return
    }

    // 2. Online Refresh
    try {
      const { data: topicData, error: topicError } = await supabase
        .from("syllabus_topics")
        .select("id, subject_id, unit_number, topic_name, description")
        .eq("subject_id", Number(subjectId))
        .order("unit_number")
        .order("id")

      if (topicError) throw topicError

      if (topicData) {
        setTopics(topicData)
        saveSyllabusTopics(subjectId, topicData)

        const topicIds = topicData.map((t) => t.id)
        if (topicIds.length > 0 && user?.id) {
          const { data: pData } = await supabase
            .from("student_topic_progress")
            .select("id, syllabus_topic_id, status, mastery_score")
            .eq("user_id", user.id)
            .in("syllabus_topic_id", topicIds)

          if (pData) {
            saveTopicProgress(user.id, pData)
            const progressMap = {}
            pData.forEach((item) => {
              progressMap[item.syllabus_topic_id] = item
            })
            setProgress(progressMap)
          }
        }
      }
    } catch (err) {
      console.warn("[Progress] Topic online load notice:", err)
      if (!cachedTopics || cachedTopics.length === 0) {
        setError("Could not load syllabus topics.")
      }
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
    const isCurrentlyOffline = typeof navigator !== "undefined" && !navigator.onLine

    // 1. Optimistic UI update
    setProgress((current) => ({
      ...current,
      [topic.id]: {
        ...(current[topic.id] || {}),
        syllabus_topic_id: topic.id,
        status,
        mastery_score: masteryScore,
        pending_sync: isCurrentlyOffline,
      },
    }))

    // 2. Local IndexedDB update
    await updateLocalTopicProgress(user.id, topic.id, status, masteryScore, isCurrentlyOffline)

    // 3. Queue offline sync
    await enqueueOperation({
      userId: user.id,
      entityType: "student_topic_progress",
      entityId: topic.id,
      operation: "upsert",
      payload: {
        syllabus_topic_id: topic.id,
        status,
        mastery_score: masteryScore,
        updated_at: new Date().toISOString(),
      },
    })

    setSavingId(null)
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
    <div className="min-h-screen bg-[#F7F7F2] p-4 sm:p-6 lg:p-8 dark:bg-[#0f1416]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
            SYLLABUS PROGRESSION
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
            Subject Mastery & Topic Status
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#52525B] font-normal dark:text-[#a1a1aa]">
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
              <div className="rounded-2xl border border-[#E4E4E7] bg-white p-5 sm:p-6 shadow-2xs lg:col-span-2 dark:border-[#27343a] dark:bg-[#141c1f]">
                <label className="text-[11px] font-bold tracking-wider text-[#71717A] uppercase dark:text-[#a1a1aa]">
                  Select Course
                </label>

                <select
                  value={selectedSubject}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedSubject(val)
                    loadTopics(val)
                  }}
                  className="mt-2 w-full rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.subject_code} — {subject.subject_name}
                    </option>
                  ))}
                </select>

                {selectedSubjectData && (
                  <p className="mt-3 text-xs text-[#52525B] font-medium dark:text-[#a1a1aa]">
                    Enrolled course for Semester {profile?.semester} ({profile?.section})
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#12312F] p-6 text-white shadow-xs flex flex-col justify-between dark:bg-[#141c1f] dark:border dark:border-[#27343a]">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-[#A1A1AA] uppercase">
                    SUBJECT MASTERY
                  </p>
                  <p className="mt-2 text-4xl font-bold text-white">{overallMastery}%</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#2DD4BF] transition-all duration-500"
                      style={{ width: `${overallMastery}%` }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-[#A1A1AA]">
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
                      className="rounded-2xl border border-[#E4E4E7] bg-white p-5 sm:p-6 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]"
                    >
                      <div className="mb-4 flex items-center justify-between border-b border-[#E4E4E7] pb-3 dark:border-[#27343a]">
                        <div>
                          <p className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
                            UNIT {unit}
                          </p>
                          <h2 className="text-lg font-bold text-[#18181B] dark:text-[#f4f4f5]">
                            Unit {unit} Curricula
                          </h2>
                        </div>

                        <span className="rounded-full bg-[#F7F7F2] px-3 py-1 text-xs font-semibold text-[#52525B] border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
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
                                  ? "border-emerald-200 bg-[#ECFDF5]/50 dark:bg-[#182226] dark:border-emerald-900/60"
                                  : status === "learning"
                                    ? "border-amber-200 bg-amber-50/40 dark:bg-[#182226] dark:border-amber-900/60"
                                    : "border-[#E4E4E7] bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#182226]"
                              }`}
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="max-w-3xl flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-bold text-sm sm:text-base text-[#18181B] dark:text-[#f4f4f5]">
                                      {topic.topic_name}
                                    </h3>

                                    {status === "mastered" && (
                                      <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#15803D] border border-emerald-200 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                                        MASTERED
                                      </span>
                                    )}

                                    {status === "learning" && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-[#D97706] border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
                                        LEARNING
                                      </span>
                                    )}

                                    {current?.pending_sync && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-[#D97706] border border-amber-200">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        Pending sync
                                      </span>
                                    )}
                                  </div>

                                  {topic.description && (
                                    <p className="mt-1.5 text-xs leading-relaxed text-[#52525B] dark:text-[#a1a1aa]">
                                      {topic.description}
                                    </p>
                                  )}

                                  <div className="mt-3.5 max-w-md">
                                    <div className="mb-1 flex items-center justify-between text-xs">
                                      <span className="font-medium text-[#71717A] dark:text-[#a1a1aa]">
                                        Mastery
                                      </span>
                                      <span className="font-bold text-[#18181B] dark:text-[#f4f4f5]">
                                        {mastery}%
                                      </span>
                                    </div>

                                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E4E4E7] dark:bg-[#27343a]">
                                      <div
                                        className={`h-full transition-all duration-500 ${
                                          status === "mastered"
                                            ? "bg-[#15803D]"
                                            : status === "learning"
                                              ? "bg-[#D97706]"
                                              : "bg-[#0F766E]"
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
                                            ? "bg-[#15803D] text-white shadow-2xs"
                                            : value === "learning"
                                              ? "bg-[#D97706] text-white shadow-2xs"
                                              : "bg-[#18181B] text-white shadow-2xs"
                                          : "border border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
                                      } disabled:opacity-50`}
                                    >
                                      {label}
                                    </button>
                                  ))}

                                  <button
                                    onClick={() => setQuizTopic(topic)}
                                    className="rounded-xl border border-teal-200 bg-[#ECFDF5] px-3.5 py-2 text-xs font-bold text-[#0F766E] hover:bg-teal-100 transition shadow-2xs active:scale-[0.98] dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]"
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
