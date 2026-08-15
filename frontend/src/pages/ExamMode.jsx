import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { generateStudyAdvice } from "../lib/api"
import ExamQuiz from "./ExamQuiz"

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
        .select("*")
        .eq("user_id", user.id)
        .gte("exam_date", new Date().toISOString())
        .order("exam_date", { ascending: true })
        .limit(1)

      if (examError) {
        throw examError
      }

      const upcomingExam = examData?.[0] || null
      setExam(upcomingExam)

      if (upcomingExam) {
        // Query academic_subjects to find matching subject
        let query = supabase.from("academic_subjects").select("id, subject_name, subject_code")
        if (profile?.semester && profile?.section) {
          query = query.eq("semester", profile.semester).eq("section", profile.section)
        }

        const { data: subjectsData } = await query
        const matchedSubject = (subjectsData || []).find((s) =>
          s.subject_name.toLowerCase().includes(upcomingExam.subject.toLowerCase()) ||
          upcomingExam.subject.toLowerCase().includes(s.subject_name.toLowerCase())
        )

        let loadedTopics = []

        if (matchedSubject) {
          const { data: topicsData } = await supabase
            .from("syllabus_topics")
            .select("*")
            .eq("subject_id", matchedSubject.id)
            .order("unit_number")

          if (topicsData && topicsData.length > 0) {
            const topicIds = topicsData.map((t) => t.id)
            const { data: progressData } = await supabase
              .from("student_topic_progress")
              .select("*")
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

        // If no syllabus topics matched, fallback to general topics
        if (loadedTopics.length === 0) {
          const { data: generalTopics } = await supabase
            .from("topics")
            .select("*")
            .eq("user_id", user.id)

          loadedTopics = (generalTopics || [])
            .filter((t) =>
              t.subject?.toLowerCase().includes(upcomingExam.subject.toLowerCase()) ||
              upcomingExam.subject?.toLowerCase().includes(t.subject?.toLowerCase())
            )
            .map((t) => ({
              id: t.id,
              topic_name: t.topic_name,
              mastery_score: Number(t.mastery_score || 0),
            }))
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
      setError("Could not load exam data.")
    }

    setLoading(false)
  }

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
        topic_name: weakestTopic?.topic_name || null,
        mastery_score: weakestTopic?.mastery_score ?? null,
        task_title: null,
        task_minutes: null,
        available_minutes: minutes,
      })

      setPlan(result)
    } catch (err) {
      console.error(err)
      setError(
        "Could not generate exam plan. Please check backend connection and try again."
      )
    }

    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-slate-600 font-medium">Loading Exam Mode...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-6 text-red-700 border border-red-200">
          {error}
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            No upcoming exam found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Add an exam in the Exams tab first to activate Exam Mode.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-red-600">
            EXAM MODE ACCELERATOR
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Prepare for {exam.subject}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Focus dynamically on high-yield revision and adaptive practice tailored to your weakest syllabus areas.
          </p>
        </div>

        {/* Exam Context Banner */}
        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                EXAM DATE
              </p>

              <p className="mt-1 font-bold text-xl">
                {new Date(exam.exam_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                IMPORTANCE
              </p>

              <p className="mt-1 font-bold text-xl text-emerald-400">
                {exam.importance}/10
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                HIGHEST-RISK TOPIC
              </p>

              <p className="mt-1 font-bold text-xl text-amber-400 truncate" title={weakestTopic?.topic_name}>
                {weakestTopic ? `${weakestTopic.topic_name} (${weakestTopic.mastery_score}%)` : "All Topics Covered"}
              </p>
            </div>
          </div>
        </div>

        {/* Adaptive Exam Quiz Simulation Section */}
        <div className="mt-6">
          {showQuiz ? (
            <ExamQuiz
              exam={exam}
              topics={examTopics}
              user={user}
              onComplete={() => {
                loadExamData()
              }}
              onClose={() => setShowQuiz(false)}
            />
          ) : (
            <div className="rounded-2xl border border-red-200/70 bg-gradient-to-br from-red-50/50 to-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold tracking-widest text-red-600">
                    ADAPTIVE EXAM SIMULATION
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    Test Yourself Before the Exam
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 max-w-xl">
                    Take an AI-generated 10-question quiz dynamically focused on your weakest topics in {exam.subject}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuiz(true)}
                  className="self-start sm:self-center shrink-0 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 shadow-md flex items-center gap-2"
                >
                  <span>🎯</span>
                  <span>Start Simulation</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Revision Strategy Section */}
        {!showQuiz && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              How much revision time do you have right now?
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              We&apos;ll formulate a time-blocked study strategy tailored to this exact session.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {[30, 60, 90, 120].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMinutes(value)}
                  className={`rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    minutes === value
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {value} min
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={generatePlan}
              disabled={generating}
              className="mt-6 w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
            >
              {generating
                ? "Building your high-yield exam plan..."
                : `Generate ${minutes}-Minute Exam Plan`}
            </button>
          </div>
        )}

        {plan && !showQuiz && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm leading-relaxed text-sm text-slate-800 font-sans">
            <h2 className="mb-4 text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
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
