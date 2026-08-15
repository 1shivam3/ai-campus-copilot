import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getAcademicRecommendation } from "../utils/academicRecommendation"
import { getTopicRecommendation } from "../utils/topicRecommendation"
import { getNextClass } from "../lib/todaySchedule"
import { getBestStudyWindow } from "../utils/freeTime"
import { generateStudyAdvice } from "../lib/api"

function AITest({ user, onStartSession, schedule, profile }) {
  const [recommendation, setRecommendation] = useState(null)
  const [topicRecommendation, setTopicRecommendation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user?.id) {
      loadAcademicContext()
    }
  }, [user])

  async function loadAcademicContext() {
    if (!user?.id) return

    setLoading(true)

    const [tasksResult, examsResult, topicsResult] =
      await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending"),

        supabase
          .from("exams")
          .select("*")
          .eq("user_id", user.id)
          .gte("exam_date", new Date().toISOString()),

        supabase
          .from("topics")
          .select("*")
          .eq("user_id", user.id),
      ])

    if (
      tasksResult.error ||
      examsResult.error ||
      topicsResult.error
    ) {
      console.error(
        tasksResult.error ||
          examsResult.error ||
          topicsResult.error
      )

      setError("Could not load academic data.")
      setLoading(false)
      return
    }

    const recommendationResult =
      getAcademicRecommendation(
        tasksResult.data || [],
        examsResult.data || []
      )

    const topicResult = getTopicRecommendation(
      examsResult.data || [],
      topicsResult.data || []
    )

    setRecommendation(recommendationResult)
    setTopicRecommendation(topicResult)
    setLoading(false)
  }

  async function askAI() {
    if (!recommendation) return

    setAiLoading(true)
    setAnswer("")
    setError("")

    try {
      const exam =
        topicRecommendation?.exam ||
        (recommendation.type === "exam"
          ? recommendation.item
          : null)

      const topic = topicRecommendation?.topic

      const task =
        recommendation.type === "task"
          ? recommendation.item
          : null

      const nextClass = getNextClass(schedule)
      const recommendedWindow = getBestStudyWindow(
        schedule,
        task ? Math.min(Number(task.estimated_minutes || 30), 60) : 30
      )

      const todayWeekday = new Date().toLocaleDateString("en-US", {
        weekday: "long",
      })

      const result = await generateStudyAdvice({
        exam_subject: exam?.subject || null,
        exam_date: exam?.exam_date || null,
        exam_importance: exam?.importance || null,
        topic_name: topic?.topic_name || null,
        mastery_score: topic?.mastery_score ?? null,
        task_title: task?.title || null,
        task_minutes: task?.estimated_minutes || null,
        available_minutes: recommendedWindow?.minutes || 60,
        today: todayWeekday,
        next_class_subject: nextClass?.academic_subjects?.subject_name || null,
        next_class_start: nextClass?.start_time?.slice(0, 5) || null,
        next_class_end: nextClass?.end_time?.slice(0, 5) || null,
        recommended_start: recommendedWindow?.start || null,
        recommended_end: recommendedWindow?.end || null,
        recommended_minutes: recommendedWindow?.minutes || null,
      })

      setAnswer(result)
    } catch (err) {
      console.error(err)
      setError(
        "AI request failed. If using the live backend, it may be waking up from cold start — please try again in a few seconds."
      )
    }

    setAiLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />

            <p className="text-xs font-bold tracking-widest text-blue-600">
              AI ACADEMIC COPILOT
            </p>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Don&apos;t plan your day.
            <br />
            Let your campus timetable plan it.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            The Copilot combines your exams, lecture schedule, deadlines and topic mastery
            to determine what deserves your attention and how to structure your open study windows.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            Analyzing your academic schedule and workload...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && recommendation && (
          <>
            <div className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-400/20">
                  AI SCHEDULE-AWARE
                </span>

                <span className="text-xs text-slate-400">
                  {profile ? `Sem ${profile.semester} · Section ${profile.section}` : "Campus Context Active"}
                </span>
              </div>

              <p className="text-xs font-bold tracking-widest text-slate-400">
                CURRENT PRIORITY
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                {recommendation.type === "exam"
                  ? `${recommendation.item.subject} Exam`
                  : recommendation.item.title}
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                {recommendation.type === "exam"
                  ? "Highest urgency exam in your academic calendar."
                  : `Target task (${recommendation.item.estimated_minutes} mins) with priority score ${recommendation.score}/10.`}
              </p>

              {/* Current Weakness Card */}
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-xs font-bold tracking-widest text-slate-400">
                  CURRENT WEAKNESS
                </p>

                {topicRecommendation?.topic ? (
                  <>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          {topicRecommendation.topic.topic_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {topicRecommendation.topic.subject}
                        </p>
                      </div>

                      <p className="text-2xl font-bold text-amber-400">
                        {topicRecommendation.topic.mastery_score}%
                      </p>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{
                          width: `${topicRecommendation.topic.mastery_score}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">
                    No weak topic detected yet.
                  </p>
                )}
              </div>

              <button
                onClick={askAI}
                disabled={aiLoading}
                className="mt-6 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:opacity-50 shadow-md"
              >
                {aiLoading
                  ? "Aligning strategy with your timetable..."
                  : "Generate My Personalized Strategy"}
              </button>
            </div>

            {/* AI Strategy Result */}
            {answer && (
              <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <p className="text-xs font-bold tracking-widest text-blue-600">
                    COPILOT STRATEGY
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    Your personalized action plan
                  </h2>
                </div>

                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700 font-sans">
                  {answer}
                </div>

                {recommendation?.type === "task" && (
                  <div className="mt-6 border-t border-slate-100 pt-6">
                    <button
                      onClick={() =>
                        onStartSession && onStartSession(recommendation.item.id)
                      }
                      className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
                    >
                      Start Recommended Session →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!loading && !error && !recommendation && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              You&apos;re all caught up 🎉
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Add a pending task or upcoming exam to get an AI study plan.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AITest
