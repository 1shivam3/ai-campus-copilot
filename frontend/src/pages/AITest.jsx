import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getAcademicRecommendation } from "../utils/academicRecommendation"
import { getTopicRecommendation } from "../utils/topicRecommendation"
import { getNextClass } from "../lib/todaySchedule"
import { getBestStudyWindow } from "../utils/freeTime"
import { generateStudyAdvice } from "../lib/api"
import { SkeletonBanner, SkeletonCard } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

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
    setError("")

    try {
      const [tasksResult, examsResult, topicsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, user_id, title, subject, deadline, importance, estimated_minutes, status")
          .eq("user_id", user.id)
          .eq("status", "pending"),

        supabase
          .from("exams")
          .select("id, user_id, subject, exam_date, importance")
          .eq("user_id", user.id)
          .gte("exam_date", new Date().toISOString()),

        supabase
          .from("topics")
          .select("id, user_id, subject, topic_name, mastery_score")
          .eq("user_id", user.id),
      ])

      if (tasksResult.error || examsResult.error || topicsResult.error) {
        throw tasksResult.error || examsResult.error || topicsResult.error
      }

      const recommendationResult = getAcademicRecommendation(
        tasksResult.data || [],
        examsResult.data || []
      )

      const topicResult = getTopicRecommendation(
        examsResult.data || [],
        topicsResult.data || []
      )

      setRecommendation(recommendationResult)
      setTopicRecommendation(topicResult)
    } catch (err) {
      console.error("Context load error:", err)
      setError("Could not load academic data.")
    } finally {
      setLoading(false)
    }
  }

  async function askAI() {
    if (!recommendation) return

    setAiLoading(true)
    setAnswer("")
    setError("")

    try {
      const exam =
        topicRecommendation?.exam ||
        (recommendation.type === "exam" ? recommendation.item : null)

      const topic = topicRecommendation?.topic

      const task =
        recommendation.type === "task" ? recommendation.item : null

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
        "AI request failed. The backend service may be waking up from cold start — please try again in a moment."
      )
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              COURSEPILOT AI INTELLIGENCE
            </p>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Schedule-Aware Study Intelligence
          </h1>

          <p className="mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-500">
            Synthesizes your timetable, active deadlines, and topic risks into a time-blocked study strategy for your next free window.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={loadAcademicContext} />
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <SkeletonBanner />
            <SkeletonCard />
          </div>
        ) : recommendation ? (
          <>
            <div className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-400/20">
                  AI SCHEDULE-AWARE
                </span>

                <span className="text-xs text-slate-400 font-medium">
                  {profile ? `Sem ${profile.semester} · Section ${profile.section}` : "Academic Context"}
                </span>
              </div>

              <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                CURRENT PRIORITY
              </p>

              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {recommendation.type === "exam"
                  ? `${recommendation.item.subject} Exam`
                  : recommendation.item.title}
              </h2>

              <p className="mt-1 text-xs sm:text-sm text-slate-300">
                {recommendation.type === "exam"
                  ? "Highest urgency exam in your academic calendar."
                  : `Target task (${recommendation.item.estimated_minutes} mins) with priority score ${recommendation.score}/10.`}
              </p>

              {/* Current Weakness Card */}
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  CURRENT WEAKNESS
                </p>

                {topicRecommendation?.topic ? (
                  <>
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <p className="text-base font-bold text-white">
                          {topicRecommendation.topic.topic_name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {topicRecommendation.topic.subject}
                        </p>
                      </div>

                      <p className="text-xl sm:text-2xl font-bold text-amber-400">
                        {topicRecommendation.topic.mastery_score}%
                      </p>
                    </div>

                    <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{
                          width: `${topicRecommendation.topic.mastery_score}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    All topics on track or no weak topics recorded yet.
                  </p>
                )}
              </div>

              <button
                onClick={askAI}
                disabled={aiLoading}
                className="mt-6 w-full rounded-xl bg-white px-5 py-3.5 text-xs sm:text-sm font-bold text-slate-950 transition hover:bg-slate-100 disabled:opacity-50 shadow-md active:scale-[0.98]"
              >
                {aiLoading
                  ? "Aligning strategy with your timetable..."
                  : "Generate Time-Blocked Strategy ✨"}
              </button>
            </div>

            {/* AI Strategy Result */}
            {answer && (
              <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-8 shadow-sm">
                <div className="mb-4 border-b border-slate-100 pb-3">
                  <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase">
                    COURSEPILOT STRATEGY
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Your Personalized Action Plan
                  </h2>
                </div>

                <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-700 font-sans">
                  {answer}
                </div>

                {recommendation?.type === "task" && onStartSession && (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <button
                      onClick={() => onStartSession(recommendation.item.id)}
                      className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm active:scale-[0.98]"
                    >
                      Start Recommended Focus Session →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon="🎉"
            title="You're all caught up"
            description="Add an assignment or upcoming exam in Tasks or Exams to activate AI personalized study strategies."
          />
        )}
      </div>
    </div>
  )
}

export default AITest
