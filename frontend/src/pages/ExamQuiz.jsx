import { useState } from "react"
import { generateExamQuiz } from "../lib/api"
import { supabase } from "../lib/supabase"

function ExamQuiz({
  exam,
  topics,
  user,
  onComplete,
  onClose,
}) {
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")

  async function startQuiz() {
    setLoading(true)
    setError("")

    try {
      const raw = await generateExamQuiz({
        subject: exam.subject,
        topics: topics.map((topic) => ({
          topic_name: topic.topic_name,
          mastery_score: Number(topic.mastery_score || 0),
        })),
        question_count: 10,
      })

      // Clean potential JSON markdown code block formatting
      let cleaned = raw.trim()
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json/, "")
      }
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```/, "")
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.replace(/```$/, "")
      }
      cleaned = cleaned.trim()

      setQuiz(JSON.parse(cleaned))
    } catch (error) {
      console.error("Exam quiz error:", error)
      setError("Could not generate exam quiz. Please try again.")
    }

    setLoading(false)
  }

  async function submitQuiz() {
    if (!quiz) return

    setSubmitting(true)

    let score = 0
    const topicStats = {}

    for (let index = 0; index < quiz.questions.length; index++) {
      const question = quiz.questions[index]
      const tName = question.topic || "General"
      if (!topicStats[tName]) {
        topicStats[tName] = { correct: 0, total: 0 }
      }
      topicStats[tName].total++

      if (Number(answers[index]) === Number(question.correct_answer)) {
        score++
        topicStats[tName].correct++
      }
    }

    const total = quiz.questions.length
    const percentage = Math.round((score / total) * 100)

    setResult({
      score,
      total,
      percentage,
      topicStats,
    })

    setSubmitting(false)

    if (onComplete) {
      onComplete(percentage)
    }
  }

  if (!quiz && !loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-widest text-red-600">
            ADAPTIVE EXAM SIMULATION
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              ✕ Close
            </button>
          )}
        </div>

        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          {exam.subject} Practice Test
        </h2>

        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          This 10-question test is dynamically weighted toward your weaker syllabus topics to simulate high-yield exam conditions.
        </p>

        {error && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={startQuiz}
            className="flex-1 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md"
          >
            Generate 10-Question Exam Quiz
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600 mb-4" />
        <h3 className="text-lg font-bold text-slate-900">Building your adaptive exam quiz...</h3>
        <p className="mt-2 text-sm text-slate-500">
          Analyzing syllabus mastery and formulating questions weighted heavily toward your weaker topics.
        </p>
      </div>
    )
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-xl">
        <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold tracking-widest text-red-700">
          EXAM PRACTICE COMPLETE
        </span>

        <h2 className="mt-4 text-4xl font-bold text-slate-900">
          {result.score} / {result.total}
        </h2>

        <p className="mt-2 text-base font-semibold text-slate-700">
          Score: {result.percentage}%
        </p>

        {/* Topic Breakdown */}
        {result.topicStats && Object.keys(result.topicStats).length > 0 && (
          <div className="mt-6 text-left rounded-2xl bg-slate-50 border border-slate-100 p-5">
            <p className="text-xs font-bold tracking-widest text-slate-500 mb-3">
              TOPIC-BY-TOPIC BREAKDOWN
            </p>
            <div className="space-y-2">
              {Object.entries(result.topicStats).map(([tName, stat]) => {
                const pct = Math.round((stat.correct / stat.total) * 100)
                return (
                  <div key={tName} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{tName}</span>
                    <span className={`font-bold ${pct >= 75 ? "text-emerald-600" : "text-amber-600"}`}>
                      {stat.correct}/{stat.total} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="mt-5 text-sm leading-6 text-slate-500">
          Use this breakdown to focus your remaining study windows on the topics where you missed marks.
        </p>

        {onClose && (
          <div className="mt-6">
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              Done & Return to Exam Mode
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-red-600">
            {exam.subject}
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            Adaptive Exam Quiz (10 Questions)
          </h2>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            ✕ Exit Quiz
          </button>
        )}
      </div>

      <div className="space-y-6">
        {quiz.questions.map((question, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                {question.topic}
              </span>
            </div>

            <p className="font-semibold text-slate-900 text-sm leading-relaxed">
              <span className="text-red-600 font-bold mr-1">{index + 1}.</span> {question.question}
            </p>

            <div className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    Number(answers[index]) === optionIndex
                      ? "border-slate-900 bg-white shadow-sm ring-1 ring-slate-900"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name={`exam-question-${index}`}
                    value={optionIndex}
                    checked={Number(answers[index]) === optionIndex}
                    onChange={() =>
                      setAnswers({
                        ...answers,
                        [index]: optionIndex,
                      })
                    }
                    className="accent-slate-900"
                  />

                  <span className="text-slate-800 font-medium">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
        <p className="text-xs font-semibold text-slate-500">
          Answered: {Object.keys(answers).length} / {quiz.questions.length}
        </p>

        <button
          onClick={submitQuiz}
          disabled={
            submitting ||
            Object.keys(answers).length !== quiz.questions.length
          }
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40 shadow-sm"
        >
          {submitting ? "Scoring Quiz..." : "Submit Exam Quiz"}
        </button>
      </div>
    </div>
  )
}

export default ExamQuiz
