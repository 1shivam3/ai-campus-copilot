import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { generateStudyAdvice } from "../lib/api"
import { getTopExamRisks } from "../utils/examPriority"
import ExamQuiz from "./ExamQuiz"
import { SkeletonBanner, SkeletonCard } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function ExamMode({ user, profile }) {
  const [exam, setExam] = useState(null)
  const [examTopics, setExamTopics] = useState([])
  const [weakestTopic, setWeakestTopic] = useState(null)
  const [minutes, setMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [plan, setPlan] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user?.id) {
      loadExamData()
    }
  }, [user, profile])

  async function loadExamData() {
    if (!user?.id) return

    setLoading(true)
    setError("")

    try {
      const { data: examData, error: examError } = await supabase
        .from("exams")
        .select("id, subject, exam_date, importance")
        .eq("user_id", user.id)
        .gte("exam_date", new Date().toISOString())
        .order("exam_date", { ascending: true })
        .limit(1)

      if (examError) throw examError

      const upcomingExam = examData?.[0] || null
      setExam(upcomingExam)

      if (upcomingExam) {
        let query = supabase.from("academic_subjects").select("id, subject_name, subject_code")
        if (profile?.semester && profile?.section) {
          query = query.eq("semester", profile.semester).eq("section", profile.section)
        }

        const { data: subjectsData } = await query
        const matchedSubject = (subjectsData || []).find(
          (s) =>
            s.subject_name.toLowerCase().includes(upcomingExam.subject.toLowerCase()) ||
            upcomingExam.subject.toLowerCase().includes(s.subject_name.toLowerCase()) ||
            (s.subject_code && upcomingExam.subject.toLowerCase().includes(s.subject_code.toLowerCase()))
        )

        let loadedTopics = []

        if (matchedSubject) {
          const { data: topicsData } = await supabase
            .from("syllabus_topics")
            .select("id, subject_id, unit_number, topic_name, description")
            .eq("subject_id", matchedSubject.id)
            .order("unit_number")

          if (topicsData && topicsData.length > 0) {
            const topicIds = topicsData.map((t) => t.id)
            const { data: progressData } = await supabase
              .from("student_topic_progress")
              .select("id, syllabus_topic_id, status, mastery_score")
              .eq("user_id", user.id)
              .in("syllabus_topic_id", topicIds)

            const pMap = {}
            if (progressData) {
              progressData.forEach((p) => {
                pMap[p.syllabus_topic_id] = p
              })
            }

            loadedTopics = topicsData.map((t) => ({
              id: t.id,
              topic_name: t.topic_name,
              description: t.description,
              unit_number: t.unit_number,
              mastery_score: Number(pMap[t.id]?.mastery_score || 0),
              status: pMap[t.id]?.status || "not_started",
            }))
          }
        }

        if (loadedTopics.length === 0 && user?.id) {
          try {
            const { data: generalProgress } = await supabase
              .from("student_topic_progress")
              .select("id, mastery_score, status, syllabus_topic_id, syllabus_topics(id, topic_name, unit_number, academic_subjects(subject_name))")
              .eq("user_id", user.id)

            loadedTopics = (generalProgress || [])
              .filter((p) => {
                const subName = p.syllabus_topics?.academic_subjects?.subject_name?.toLowerCase() || ""
                const examSub = upcomingExam.subject?.toLowerCase() || ""
                return subName.includes(examSub) || examSub.includes(subName)
              })
              .map((p) => ({
                id: p.syllabus_topic_id || p.id,
                topic_name: p.syllabus_topics?.topic_name || "Topic",
                mastery_score: Number(p.mastery_score || 0),
                status: p.status || "not_started",
              }))
          } catch (fbErr) {
            console.warn("Exam mode fallback topic notice:", fbErr)
          }
        }

        setExamTopics(loadedTopics)

        if (loadedTopics.length > 0) {
          const sorted = [...loadedTopics].sort(
            (a, b) => a.mastery_score - b.mastery_score
          )
          setWeakestTopic(sorted[0])
        }
      }
    } catch (err) {
      console.error("Exam load error:", err)
      setError("Could not load exam data. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const topRisks = getTopExamRisks(examTopics, 5)

  async function generatePlan() {
    if (!exam) return

    setGenerating(true)
    setPlan("")
    setError("")

    try {
      const result = await generateStudyAdvice({
        exam_subject: exam?.subject || null,
        exam_date: exam?.exam_date || null,
        exam_importance: exam?.importance || null,
        topic_name:
          topRisks.length > 0
            ? topRisks.map((t) => `${t.topic_name} (${t.mastery_score}% mastery)`).join(", ")
            : weakestTopic?.topic_name || null,
        mastery_score:
          topRisks.length > 0
            ? Math.min(...topRisks.map((t) => Number(t.mastery_score || 0)))
            : weakestTopic?.mastery_score ?? null,
        task_title: null,
        task_minutes: null,
        available_minutes: minutes,
      })

      setPlan(result)
    } catch (err) {
      console.error(err)
      setError(
        "Could not generate exam plan. The backend may be waking up — please try again in a few seconds."
      )
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <SkeletonBanner />
        <SkeletonCard />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <ErrorState message={error} onRetry={loadExamData} />
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <EmptyState
          icon="🎯"
          title="No upcoming exam found"
          description="Add an upcoming exam in the Exams tab to activate targeted exam preparation and adaptive simulations."
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-red-600 uppercase">
            EXAM MODE ACCELERATOR
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Prepare for {exam.subject}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Target high-yield revision and adaptive practice tailored dynamically to your lowest syllabus scores.
          </p>
        </div>

        {/* Exam Context Banner */}
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                EXAM DATE
              </p>
              <p className="mt-1 font-bold text-lg sm:text-xl">
                {new Date(exam.exam_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                IMPORTANCE
              </p>
              <p className="mt-1 font-bold text-lg sm:text-xl text-emerald-400">
                {exam.importance || 8}/10
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                HIGHEST-RISK TOPIC
              </p>
              <p
                className="mt-1 font-bold text-lg sm:text-xl text-amber-400 truncate"
                title={weakestTopic?.topic_name}
              >
                {weakestTopic
                  ? `${weakestTopic.topic_name} (${weakestTopic.mastery_score}%)`
                  : "All Topics Covered"}
              </p>
            </div>
          </div>
        </div>

        {/* Highest-Risk Topics */}
        {topRisks.length > 0 && !showQuiz && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-red-600 uppercase">
                  HIGHEST-RISK TOPICS
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                  Focus Here First
                </h2>
              </div>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                {topRisks.length} Priority Areas
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {topRisks.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 transition hover:bg-slate-100/70"
                >
                  <div className="flex-1 pr-3 min-w-0">
                    <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {topic.topic_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Mastery:{" "}
                      <strong
                        className={
                          topic.mastery_score >= 60 ? "text-blue-600" : "text-amber-600"
                        }
                      >
                        {topic.mastery_score}%
                      </strong>
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
                      topic.mastery_score <= 40
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {topic.mastery_score <= 40 ? "Critical" : "Moderate"} Risk
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adaptive Exam Quiz Simulation */}
        <div className="mt-6">
          {showQuiz ? (
            <ExamQuiz
              exam={exam}
              topics={examTopics}
              user={user}
              onComplete={() => loadExamData()}
              onClose={() => setShowQuiz(false)}
            />
          ) : (
            <div className="rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50/50 to-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-red-600 uppercase">
                    ADAPTIVE SIMULATION
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                    Test Yourself Before the Exam
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 max-w-xl">
                    Launch a customizable, dynamic practice test tailored to your syllabus units, question formats (MCQ, Short Answer, Long Answer), and difficulty.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuiz(true)}
                  className="self-start sm:self-center shrink-0 rounded-xl bg-red-600 px-5 py-3 text-xs sm:text-sm font-bold text-white transition hover:bg-red-700 shadow-md active:scale-[0.98] flex items-center gap-2"
                >
                  <span>🎯</span>
                  <span>Configure & Start Test</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Revision Strategy Plan */}
        {!showQuiz && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              How much revision time do you have right now?
            </h2>

            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Formulate a time-blocked study strategy tailored to this exact session focusing on your highest-risk topics.
            </p>

            <div className="mt-4 flex flex-wrap gap-2.5">
              {[30, 60, 90, 120].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinutes(val)}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                    minutes === val
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {val} min
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={generatePlan}
              disabled={generating}
              className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm active:scale-[0.98]"
            >
              {generating
                ? "Building your high-yield exam plan..."
                : `Generate ${minutes}-Minute Exam Plan`}
            </button>
          </div>
        )}

        {plan && !showQuiz && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm leading-relaxed text-xs sm:text-sm text-slate-800 font-sans">
            <h2 className="mb-4 text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              🎯 Your Rapid Exam Strategy ({minutes} mins)
            </h2>
            {plan}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamMode
