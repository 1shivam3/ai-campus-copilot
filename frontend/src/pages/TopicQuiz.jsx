import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { generateTopicQuiz } from "../lib/api"
import { updateLocalTopicProgress } from "../lib/offlineDb"

function TopicQuiz({ topic, user, onComplete, onClose }) {
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (topic?.id) {
      generateQuiz()
    }
  }, [topic?.id])

  async function generateQuiz() {
    setLoading(true)
    setError("")
    setQuiz(null)
    setAnswers({})
    setResult(null)

    try {
      const data = await generateTopicQuiz({
        topic_name: topic.topic_name,
        description: topic.description || "",
      })

      if (data && data.questions && data.questions.length > 0) {
        setQuiz(data)
      } else {
        throw new Error("Could not parse quiz questions.")
      }
    } catch (err) {
      console.error(err)
      setError(
        "Could not generate questions for this topic. Please ensure the backend AI server is running."
      )
    } finally {
      setLoading(false)
    }
  }

  async function submitQuiz() {
    if (!quiz || !quiz.questions) return

    setSubmitting(true)
    setError("")

    let correct = 0
    quiz.questions.forEach((q, index) => {
      if (Number(answers[index]) === q.correct_index) {
        correct++
      }
    })

    const total = quiz.questions.length
    const scorePercentage = Math.round((correct / total) * 100)

    try {
      const { data: currentProgress } = await supabase
        .from("student_topic_progress")
        .select("mastery_score")
        .eq("user_id", user.id)
        .eq("syllabus_topic_id", topic.id)
        .single()

      const currentMastery = currentProgress?.mastery_score || 0
      const newMastery = Math.min(
        100,
        Math.round(currentMastery * 0.4 + scorePercentage * 0.6)
      )

      let newStatus = "learning"
      if (newMastery >= 75) newStatus = "mastered"
      else if (newMastery === 0) newStatus = "not_started"

      if (user?.id) {
        await supabase
          .from("student_topic_progress")
          .upsert({
            user_id: user.id,
            syllabus_topic_id: topic.id,
            status: newStatus,
            mastery_score: newMastery,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,syllabus_topic_id" })

        try {
          await updateLocalTopicProgress(user.id, topic.id, newStatus, newMastery, false)
        } catch (e) {
          console.warn("Could not save to local offlineDb:", e)
        }
      }

      setResult({
        score: correct,
        total,
        percentage: scorePercentage,
        previousMastery: currentMastery,
        newMastery,
      })

      if (onComplete) {
        onComplete(newMastery)
      }
    } catch (err) {
      console.error(err)
      setError("Could not record test score. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-[#E4E4E7] bg-white p-8 sm:p-12 text-center shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-[#0F766E] border-t-transparent" />
        <h3 className="text-base sm:text-lg font-bold text-[#18181B] dark:text-[#f4f4f5]">
          Synthesizing Assessment Questions
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-[#52525B] max-w-sm mx-auto dark:text-[#a1a1aa]">
          Analyzing topic &ldquo;{topic?.topic_name}&rdquo; and extracting high-yield questions...
        </p>
      </div>
    )
  }

  if (error && !quiz) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center shadow-2xs">
        <h3 className="text-sm sm:text-base font-bold text-[#DC2626]">
          Quiz Generation Failed
        </h3>
        <p className="mt-1 text-xs text-[#DC2626]/80">{error}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={generateQuiz}
            className="rounded-xl bg-[#0F766E] px-4 py-2 text-xs font-bold text-white hover:bg-[#115E59] shadow-2xs transition"
          >
            Try Again
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 transition"
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
      <div className="rounded-3xl border border-[#E4E4E7] bg-white p-8 text-center shadow-lg dark:border-[#27343a] dark:bg-[#141c1f]">
        <p className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
          QUIZ COMPLETE
        </p>

        <h2 className="mt-3 text-3xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
          {result.score}/{result.total}
        </h2>

        <p className="mt-2 text-sm text-[#52525B] dark:text-[#a1a1aa]">
          Quiz score: {result.percentage}%
        </p>

        <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-[#F7F7F2] border border-[#E4E4E7] p-5 dark:border-[#27343a] dark:bg-[#182226]">
          <p className="text-[11px] font-bold tracking-widest text-[#71717A] uppercase dark:text-[#a1a1aa]">
            WEIGHTED MASTERY UPDATE
          </p>

          <div className="mt-3 flex items-center justify-center gap-4">
            <div>
              <p className="text-xs text-[#71717A] dark:text-[#a1a1aa]">
                Before
              </p>

              <p className="text-2xl font-bold text-[#52525B] dark:text-[#d4d4d8]">
                {result.previousMastery}%
              </p>
            </div>

            <span className="text-[#71717A] font-bold dark:text-[#a1a1aa]">
              →
            </span>

            <div>
              <p className="text-xs text-[#71717A] dark:text-[#a1a1aa]">
                Now
              </p>

              <p className="text-2xl font-bold text-[#15803D] dark:text-[#2DD4BF]">
                {result.newMastery}%
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-[#52525B] dark:text-[#a1a1aa]">
          CoursePilot will use this updated mastery when recommending what to study next.
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-xl bg-[#0F766E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#115E59] transition shadow-2xs"
            >
              Done & Return
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-[#E4E4E7] bg-white p-6 shadow-xl lg:p-8 dark:border-[#27343a] dark:bg-[#141c1f]">
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-[#E4E4E7] pb-5 sm:flex-row sm:items-center dark:border-[#27343a]">
        <div>
          <p className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
            AI TOPIC MASTERY QUIZ
          </p>

          <h2 className="mt-1 text-2xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
            {topic.topic_name}
          </h2>

          {topic.description && (
            <p className="mt-1 text-xs text-[#52525B] max-w-xl dark:text-[#a1a1aa]">
              {topic.description}
            </p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start rounded-xl border border-[#E4E4E7] bg-[#F7F7F2] px-3 py-1.5 text-xs font-semibold text-[#52525B] hover:bg-[#E4E4E7] transition dark:border-[#27343a] dark:bg-[#182226] dark:text-[#a1a1aa]"
          >
            ✕ Close
          </button>
        )}
      </div>

      <div className="space-y-6">
        {quiz?.questions?.map((question, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-5 dark:border-[#27343a] dark:bg-[#182226]"
          >
            <p className="font-semibold text-[#18181B] text-sm leading-relaxed dark:text-[#f4f4f5]">
              <span className="text-[#0F766E] font-bold mr-1 dark:text-[#2DD4BF]">{index + 1}.</span> {question.question}
            </p>

            <div className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    Number(answers[index]) === optionIndex
                      ? "border-[#0F766E] bg-[#ECFDF5] shadow-2xs ring-1 ring-[#0F766E] dark:bg-[#141c1f] dark:border-[#2DD4BF] dark:ring-[#2DD4BF]"
                      : "border-[#E4E4E7] bg-white hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f]"
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
                    className="accent-[#0F766E]"
                  />

                  <span className="text-[#18181B] font-medium dark:text-[#f4f4f5]">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[#E4E4E7] pt-5 dark:border-[#27343a]">
        <p className="text-xs font-semibold text-[#52525B] dark:text-[#a1a1aa]">
          Answered: {Object.keys(answers).length} / {quiz?.questions?.length || 0}
        </p>

        <button
          onClick={submitQuiz}
          disabled={
            submitting ||
            Object.keys(answers).length !== (quiz?.questions?.length || 0)
          }
          className="rounded-xl bg-[#0F766E] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#115E59] disabled:opacity-40 shadow-2xs active:scale-[0.98]"
        >
          {submitting ? "Scoring & Updating Mastery..." : "Submit Quiz"}
        </button>
      </div>
    </div>
  )
}

export default TopicQuiz
