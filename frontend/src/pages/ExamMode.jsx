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

            if (generalProgress) {
              const filtered = generalProgress.filter(
                (p) =>
                  p.syllabus_topics?.academic_subjects?.subject_name
                    ?.toLowerCase()
                    .includes(upcomingExam.subject.toLowerCase())
              )
              loadedTopics = filtered.map((p) => ({
                id: p.syllabus_topic_id,
                topic_name: p.syllabus_topics?.topic_name || "Topic",
                mastery_score: Number(p.mastery_score || 0),
                status: p.status || "not_started",
              }))
            }
          } catch (e) {
            console.warn("Could not query general progress fallback", e)
          }
        }

        setExamTopics(loadedTopics)

        if (loadedTopics.length > 0) {
          const sorted = [...loadedTopics].sort(
            (a, b) => (a.mastery_score || 0) - (b.mastery_score || 0)
          )
          setWeakestTopic(sorted[0])
        } else {
          setWeakestTopic(null)
        }
      }
    } catch (err) {
      console.error(err)
      setError("Could not load your upcoming exam data.")
    } finally {
      setLoading(false)
    }
  }

  async function generatePlan() {
    if (!exam) return

    setGenerating(true)
    setError("")

    try {
      const topRisks = getTopExamRisks(examTopics, 3)
      const riskSummary = topRisks.map((t) => `${t.topic_name} (${t.mastery_score}% mastery)`).join(", ")

      const prompt = `Student has an upcoming exam for ${exam.subject} on ${new Date(exam.exam_date).toLocaleDateString()}.
Importance: ${exam.importance}/10.
Available revision session: ${minutes} minutes.
Highest-risk topics: ${riskSummary || "General review"}.
Create a high-yield, structured study breakdown divided into precise minute blocks.`

      const response = await generateStudyAdvice(prompt)
      setPlan(response)
    } catch (err) {
      console.error(err)
      setError("Could not generate your revision strategy. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const topRisks = getTopExamRisks(examTopics, 3)

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
          <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
            EXAM PREPARATION ENGINE
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Prepare for {exam.subject}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal">
            Target high-yield revision and adaptive practice tailored dynamically to your lowest syllabus scores.
          </p>
        </div>

        {/* Exam Context Banner */}
        <div className="rounded-2xl bg-slate-900 p-5 sm:p-6 text-white shadow-xs">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                EXAM DATE
              </p>
              <p className="mt-1 font-bold text-base sm:text-lg font-mono">
                {new Date(exam.exam_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                IMPORTANCE
              </p>
              <p className="mt-1 font-bold text-base sm:text-lg text-blue-400">
                {exam.importance || 8}/10
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                HIGHEST-RISK TOPIC
              </p>
              <p
                className="mt-1 font-bold text-base sm:text-lg text-amber-400 truncate"
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
          <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
                  HIGH-YIELD FOCUS AREAS
                </p>
                <h2 className="mt-0.5 text-base font-bold text-slate-900">
                  Focus on Weakest Topics First
                </h2>
              </div>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200/60">
                {topRisks.length} Priority Areas
              </span>
            </div>

            <div className="mt-3.5 space-y-2">
              {topRisks.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex-1 pr-3 min-w-0">
                    <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {topic.topic_name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
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
                        ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                        : "bg-amber-50 text-amber-800 border border-amber-200/60"
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
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                    ADAPTIVE SIMULATION
                  </p>
                  <h3 className="mt-0.5 text-base font-bold text-slate-900">
                    Practice Exam Questions
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 max-w-xl font-normal">
                    Launch a customizable practice test tailored to your syllabus units, question formats, and difficulty.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuiz(true)}
                  className="self-start sm:self-center shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-blue-700 shadow-xs active:scale-[0.98] flex items-center gap-2"
                >
                  <span>Configure & Start Test →</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Revision Strategy Plan */}
        {!showQuiz && (
          <div className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">
              How much revision time do you have right now?
            </h2>

            <p className="mt-1 text-xs text-slate-500 font-normal">
              Formulate a time-blocked study strategy tailored to this exact session focusing on your highest-risk topics.
            </p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {[30, 60, 90, 120].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinutes(val)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] ${
                    minutes === val
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs active:scale-[0.98]"
            >
              {generating
                ? "Building your high-yield exam plan..."
                : `Generate ${minutes}-Minute Revision Plan`}
            </button>
          </div>
        )}

        {plan && !showQuiz && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs leading-relaxed text-xs sm:text-sm text-slate-800 font-sans">
            <h2 className="mb-3 text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5">
              Your Exam Strategy ({minutes} mins)
            </h2>
            {plan}
          </div>
        )}
      </div>
    </div>
  )
}

export default ExamMode
