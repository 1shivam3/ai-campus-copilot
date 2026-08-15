import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getWeakestTopic } from "../utils/topicRecommendation"
import { generateStudyAdvice } from "../lib/api"

function ExamMode({ user }) {
  const [exam, setExam] = useState(null)
  const [topic, setTopic] = useState(null)
  const [minutes, setMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user?.id) {
      loadExamData()
    }
  }, [user])

  async function loadExamData() {
    if (!user?.id) return

    setLoading(true)

    const [examResult, topicsResult] = await Promise.all([
      supabase
        .from("exams")
        .select("*")
        .eq("user_id", user.id)
        .gte("exam_date", new Date().toISOString())
        .order("exam_date", { ascending: true })
        .limit(1),

      supabase
        .from("topics")
        .select("*")
        .eq("user_id", user.id),
    ])

    if (examResult.error || topicsResult.error) {
      console.error(examResult.error || topicsResult.error)
      setError("Could not load exam information.")
      setLoading(false)
      return
    }

    const upcomingExam = examResult.data?.[0] || null

    setExam(upcomingExam)

    if (upcomingExam) {
      const weakest = getWeakestTopic(
        topicsResult.data || [],
        upcomingExam.subject
      )

      setTopic(weakest)
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
        topic_name: topic?.topic_name || null,
        mastery_score: topic?.mastery_score ?? null,
        task_title: null,
        task_minutes: null,
        available_minutes: minutes,
      })

      setPlan(result)
    } catch (err) {
      console.error(err)
      setError(
        "Could not generate exam plan. The backend may be waking up from cold start — please try again in a few seconds."
      )
    }

    setGenerating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-slate-600 font-medium">Loading Exam Mode...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-red-50 p-6 text-red-700 border border-red-200">
          {error}
        </div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            No upcoming exam found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Add an exam in the Exams tab first to use Exam Mode.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
            Exam Mode
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Prepare for {exam.subject}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Focus only on what gives you the highest return before
            the exam.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-lg">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                EXAM DATE
              </p>

              <p className="mt-1 font-semibold text-lg">
                {new Date(
                  exam.exam_date
                ).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                IMPORTANCE
              </p>

              <p className="mt-1 font-semibold text-lg">
                {exam.importance}/10
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                WEAKEST TOPIC
              </p>

              <p className="mt-1 font-semibold text-lg text-amber-400">
                {topic ? `${topic.topic_name} (${topic.mastery_score}%)` : "Not available"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            How much time do you have?
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll build a high-yield revision plan tailored to this exact session time.
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
                    : "border text-slate-700 hover:bg-slate-50"
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
              ? "Building your exam plan..."
              : `Generate ${minutes}-Minute Exam Plan`}
          </button>
        </div>

        {plan && (
          <div className="mt-6 whitespace-pre-wrap rounded-2xl border bg-white p-6 shadow-sm leading-relaxed text-sm text-slate-800 font-sans">
            <h2 className="mb-4 text-lg font-bold text-slate-900 border-b pb-3">
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
