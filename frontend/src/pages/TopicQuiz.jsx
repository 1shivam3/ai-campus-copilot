import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { generateTopicQuiz } from "../lib/api"

function TopicQuiz({ topic, user, onComplete, onClose }) {
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    generateQuiz()
  }, [topic])

  async function generateQuiz() {
    if (!topic) return
    setLoading(true)
    setError("")

    try {
      const raw = await generateTopicQuiz({
        topic_name: topic.topic_name,
        topic_description: topic.description,
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

      const parsed = JSON.parse(cleaned)
      setQuiz(parsed)
    } catch (error) {
      console.error("Quiz generation error:", error)
      setError("Could not generate quiz. Please try again.")
    }

    setLoading(false)
  }

  async function submitQuiz() {
    if (!quiz || !user?.id) return

    setSubmitting(true)

    let score = 0
    quiz.questions.forEach((question, index) => {
      if (
        Number(answers[index]) ===
        Number(question.correct_answer)
      ) {
        score++
      }
    })

    const total = quiz.questions.length
    const percentage = Math.round((score / total) * 100)

    try {
      const { error: attemptError } = await supabase
        .from("topic_quiz_attempts")
        .insert({
          user_id: user.id,
          syllabus_topic_id: topic.id,
          score,
          total_questions: total,
          answers,
        })

      if (attemptError) {
        console.error("Attempt error:", attemptError)
      }

      const { error: progressError } = await supabase
        .from("student_topic_progress")
        .upsert(
          {
            user_id: user.id,
            syllabus_topic_id: topic.id,
            status: percentage >= 80 ? "mastered" : "learning",
            mastery_score: percentage,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,syllabus_topic_id",
          }
        )

      if (progressError) {
        console.error("Progress update error:", progressError)
      }

      setResult({
        score,
        total,
        percentage,
      })

      if (onComplete) {
        onComplete(percentage, percentage >= 80 ? "mastered" : "learning")
      }
    } catch (err) {
      console.error("Submission error:", err)
      setError("Failed to save quiz results.")
    }

    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 mb-4" />
        <h3 className="text-lg font-bold text-slate-900">AI is crafting your topic quiz...</h3>
        <p className="mt-1 text-sm text-slate-500">Generating conceptual multiple-choice questions tailored to {topic.topic_name}.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-lg">
        <p className="font-semibold text-red-800">{error}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={generateQuiz}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
          >
            Try Again
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-lg">
        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-bold tracking-widest text-blue-700">
          QUIZ COMPLETE
        </span>

        <h2 className="mt-4 text-4xl font-bold text-slate-900">
          {result.score} / {result.total}
        </h2>

        <p className="mt-2 text-base font-semibold text-slate-700">
          {result.percentage >= 80 ? "🎉 Outstanding! You mastered this topic." : "👍 Good effort! Marked as Learning."}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Your topic mastery score has been objectively updated to <strong>{result.percentage}%</strong> in the Copilot engine.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
            >
              Done & Return
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-blue-600">
            AI TOPIC MASTERY QUIZ
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {topic.topic_name}
          </h2>

          {topic.description && (
            <p className="mt-1 text-xs text-slate-500 max-w-xl">
              {topic.description}
            </p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            ✕ Close
          </button>
        )}
      </div>

      <div className="space-y-6">
        {quiz?.questions?.map((question, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5"
          >
            <p className="font-semibold text-slate-900 text-sm leading-relaxed">
              <span className="text-blue-600 font-bold mr-1">{index + 1}.</span> {question.question}
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
                    name={`question-${index}`}
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
          Answered: {Object.keys(answers).length} / {quiz?.questions?.length || 0}
        </p>

        <button
          onClick={submitQuiz}
          disabled={
            submitting ||
            Object.keys(answers).length !== (quiz?.questions?.length || 0)
          }
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-40 shadow-sm"
        >
          {submitting ? "Scoring & Updating Mastery..." : "Submit Quiz"}
        </button>
      </div>
    </div>
  )
}

export default TopicQuiz
