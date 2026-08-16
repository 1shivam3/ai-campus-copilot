import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { generateStudyPack, askStudyMaterial } from "../lib/api"
import ErrorState from "../components/ErrorState"

function StudyPack({ materialId, user, profile, onBack, onOpenReader, onNavigateToSyllabus, onOpenFlashcards }) {
  // Document State
  const [material, setMaterial] = useState(null)
  const [matchedTopics, setMatchedTopics] = useState([])
  const [studyPack, setStudyPack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Interactive Checklist State
  const [checkedItems, setCheckedItems] = useState(() => new Set())

  // Inline Quiz State (Triggered from bottom action)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState(null)
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [quizFinished, setQuizFinished] = useState(false)

  // ---------------------------------------------------------
  // 1. LOAD STUDY PACK & DOCUMENT METADATA
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      if (!materialId || !user?.id) return

      setLoading(true)
      setError("")

      try {
        // 1. Fetch document metadata
        const { data: docData, error: docErr } = await supabase
          .from("study_materials")
          .select(`
            id,
            user_id,
            title,
            subject_id,
            unit_number,
            material_type,
            extracted_character_count,
            created_at,
            academic_subjects (
              id,
              subject_name,
              subject_code
            )
          `)
          .eq("id", Number(materialId))
          .maybeSingle()

        if (docErr || !docData) {
          throw new Error("Could not find this study material.")
        }

        if (docData.user_id !== user.id) {
          throw new Error("Access denied. You do not own this study material.")
        }

        setMaterial(docData)

        // 2. Fetch matched syllabus topics
        try {
          const { data: topicsData } = await supabase
            .from("study_material_topics")
            .select(`
              id,
              match_score,
              syllabus_topics (
                id,
                topic_name,
                unit_number
              )
            `)
            .eq("study_material_id", Number(materialId))
            .order("match_score", { ascending: false })

          setMatchedTopics(topicsData || [])
        } catch (topicsErr) {
          console.warn("Matched topics load note:", topicsErr)
        }

        // 3. Load or generate Study Pack (cached unless requested)
        const packRes = await generateStudyPack({
          studyMaterialId: materialId,
          userId: user.id,
          forceRegenerate: false,
        })

        if (packRes?.study_pack) {
          setStudyPack(packRes.study_pack)
        } else {
          throw new Error("Study pack could not be generated.")
        }
      } catch (err) {
        console.error("Study Pack load error:", err)
        setError(err.message || "The study pack could not be generated right now. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [materialId, user])

  // ---------------------------------------------------------
  // 2. REGENERATE STUDY PACK
  // ---------------------------------------------------------
  async function handleRegenerate() {
    if (!materialId || !user?.id) return

    setRegenerating(true)
    setError("")
    setSuccessMsg("")

    try {
      const res = await generateStudyPack({
        studyMaterialId: materialId,
        userId: user.id,
        forceRegenerate: true,
      })

      if (res?.study_pack) {
        setStudyPack(res.study_pack)
        setCheckedItems(new Set())
        setSuccessMsg("✓ Study Pack regenerated successfully with updated citations!")
      }
    } catch (err) {
      console.error("Regenerate error:", err)
      setError("Failed to regenerate study pack. Please try again.")
    } finally {
      setRegenerating(false)
    }
  }

  // ---------------------------------------------------------
  // 3. GENERATE QUIZ FROM STUDY PACK
  // ---------------------------------------------------------
  async function handleGenerateQuiz() {
    if (!materialId || !user?.id) return

    setQuizLoading(true)
    setError("")

    try {
      const res = await askStudyMaterial({
        studyMaterialId: materialId,
        userId: user.id,
        question: "Generate practice quiz",
        actionType: "quiz",
      })

      let cleanStr = (res.answer || "").trim()
      if (cleanStr.startsWith("```json")) cleanStr = cleanStr.slice(7)
      if (cleanStr.startsWith("```")) cleanStr = cleanStr.slice(3)
      if (cleanStr.endsWith("```")) cleanStr = cleanStr.slice(0, -3)
      const quizData = JSON.parse(cleanStr.trim())

      if (quizData?.questions && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
        setQuizQuestions(quizData.questions)
        setCurrentQuizIndex(0)
        setSelectedAnswers({})
        setQuizFinished(false)

        // Smooth scroll to quiz section
        setTimeout(() => {
          document.getElementById("study-pack-quiz-section")?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      } else {
        throw new Error("Invalid quiz format received.")
      }
    } catch (err) {
      console.error("Quiz error:", err)
      setError("Could not generate practice quiz from this material.")
    } finally {
      setQuizLoading(false)
    }
  }

  function toggleCheckItem(idx) {
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) {
        next.delete(idx)
      } else {
        next.add(idx)
      }
      return next
    })
  }

  function handleSelectOption(optionIndex) {
    if (selectedAnswers[currentQuizIndex] !== undefined) return
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuizIndex]: optionIndex,
    }))
  }

  function handleNextQuizQuestion() {
    if (!quizQuestions) return
    if (currentQuizIndex + 1 < quizQuestions.length) {
      setCurrentQuizIndex((prev) => prev + 1)
    } else {
      setQuizFinished(true)
    }
  }

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-44 animate-pulse rounded-3xl bg-white border border-slate-200" />
          <div className="h-72 animate-pulse rounded-3xl bg-white border border-slate-200" />
          <div className="h-72 animate-pulse rounded-3xl bg-white border border-slate-200" />
        </div>
      </div>
    )
  }

  // Error State
  if (error && !studyPack) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            ← Back to Study Material
          </button>
          <ErrorState
            message={error || "Your document is indexed, but the study pack could not be generated."}
            onRetry={handleRegenerate}
          />
        </div>
      </div>
    )
  }

  const subjectCode = material?.academic_subjects?.subject_code
  const subjectLabel =
    material?.academic_subjects?.subject_name ||
    (subjectCode ? `${subjectCode} Course Material` : "Academic Course Material")

  const formattedDate = studyPack?.updated_at
    ? new Date(studyPack.updated_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently"

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            ← Back to Study Material Library
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              {regenerating ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
                  Regenerating...
                </span>
              ) : (
                <span>Regenerate Study Pack 🔄</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenReader && onOpenReader(materialId)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <span>Ask AI About Material ✨</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg("")}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Document Card */}
        <header className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              📘 {subjectLabel} {subjectCode ? `(${subjectCode})` : ""}
            </span>
            {material?.unit_number && (
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700">
                Unit {material.unit_number}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {material?.material_type || "Study Pack"}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              ✓ Grounded in Document
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {material?.title || "Study Pack"}
          </h1>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            AI Study Pack · Last updated {formattedDate}
          </p>

          {/* Matched Syllabus Topics Pills */}
          {matchedTopics.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                MATCHED SYLLABUS TOPICS
              </p>
              <div className="flex flex-wrap gap-2">
                {matchedTopics.map((mt) => {
                  const topicName = mt.syllabus_topics?.topic_name || mt.topic_name || "Syllabus Topic"
                  const score = Math.round(Number(mt.match_score))
                  return (
                    <button
                      key={mt.id || mt.syllabus_topic_id}
                      type="button"
                      onClick={() => onNavigateToSyllabus && onNavigateToSyllabus()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 transition"
                    >
                      <span>{topicName}</span>
                      <span className="font-mono text-[10px] font-bold text-blue-600">
                        {score}%
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Study Tools Bar */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                STUDY TOOLS
              </p>
              <p className="text-xs text-slate-400">
                Turn this material into active recall aids
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenFlashcards && onOpenFlashcards(materialId)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs active:scale-[0.98]"
              >
                <span>🎴 Flashcards</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  document.getElementById("study-pack-quiz-section")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs active:scale-[0.98]"
              >
                <span>📝 Practice Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenReader && onOpenReader(materialId)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-2xs active:scale-[0.98]"
              >
                <span>💬 Ask AI</span>
              </button>
            </div>
          </div>
        </header>

        {/* 1. EXECUTIVE SUMMARY */}
        {studyPack?.summary && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-sm">
                📌
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Comprehensive Summary
              </h2>
            </div>
            <div className="prose prose-sm max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans selection:bg-blue-100">
              {studyPack.summary}
            </div>
          </section>
        )}

        {/* 2. KEY CONCEPTS */}
        {studyPack?.key_concepts && studyPack.key_concepts.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                🔑
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Key Concepts
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {studyPack.key_concepts.map((concept, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-mono text-[11px] font-bold text-emerald-800">
                    {idx + 1}
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                    {concept}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. IMPORTANT DEFINITIONS */}
        {studyPack?.definitions && studyPack.definitions.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 font-bold text-sm">
                📖
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Important Definitions & Formulas
              </h2>
            </div>
            <div className="space-y-3">
              {studyPack.definitions.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50"
                >
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 mb-1">
                    {item.term}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed font-sans">
                    {item.definition}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. HIGH-YIELD POINTS */}
        {studyPack?.high_yield_points && studyPack.high_yield_points.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 font-bold text-sm">
                🎯
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                High-Yield Exam Points
              </h2>
            </div>
            <div className="space-y-2.5">
              {studyPack.high_yield_points.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-3.5"
                >
                  <span className="text-amber-600 font-bold mt-0.5">✦</span>
                  <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. COMMON CONFUSIONS & PITFALLS */}
        {studyPack?.common_confusions && studyPack.common_confusions.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-700 font-bold text-sm">
                ⚠️
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Common Confusions & Misconceptions
              </h2>
            </div>
            <div className="space-y-3">
              {studyPack.common_confusions.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs mb-1.5">
                    <span>❌ Misconception:</span>
                    <span>{item.confusion}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-800 text-xs sm:text-sm">
                    <span className="text-emerald-600 font-bold">✓ Correction:</span>
                    <p className="font-medium leading-relaxed">{item.clarification}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. WORKED EXAMPLES */}
        {studyPack?.examples && studyPack.examples.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm">
                💡
              </span>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                Illustrative Examples & Code
              </h2>
            </div>
            <div className="space-y-3">
              {studyPack.examples.map((ex, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500"
                >
                  {ex}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. QUICK REVISION CHECKLIST */}
        {studyPack?.quick_revision && studyPack.quick_revision.length > 0 && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                  ✅
                </span>
                <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                  Quick Revision Checklist
                </h2>
              </div>
              <span className="font-mono text-xs font-bold text-slate-500">
                {checkedItems.size}/{studyPack.quick_revision.length} Completed
              </span>
            </div>

            <div className="space-y-2">
              {studyPack.quick_revision.map((item, idx) => {
                const isChecked = checkedItems.has(idx)
                return (
                  <label
                    key={idx}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition select-none ${
                      isChecked
                        ? "border-emerald-200 bg-emerald-50/50 text-slate-500"
                        : "border-slate-100 bg-slate-50/70 text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCheckItem(idx)}
                      className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span
                      className={`text-xs sm:text-sm font-medium leading-relaxed ${
                        isChecked ? "line-through opacity-75" : ""
                      }`}
                    >
                      {item}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        )}

        {/* 8. INTERACTIVE PRACTICE QUIZ SECTION */}
        <section
          id="study-pack-quiz-section"
          className="rounded-3xl border border-blue-200/80 bg-white p-6 sm:p-7 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                KNOWLEDGE CHECK
              </span>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Ready to test your mastery?
              </h2>
              <p className="text-xs text-slate-500">
                Practice 5 questions generated directly from this study document.
              </p>
            </div>

            {!quizQuestions && (
              <button
                type="button"
                disabled={quizLoading}
                onClick={handleGenerateQuiz}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {quizLoading ? "Generating Quiz..." : "Generate Quiz from This Material →"}
              </button>
            )}
          </div>

          {/* Render Quiz if generated */}
          {quizQuestions && quizQuestions.length > 0 && (
            <div className="mt-4">
              {!quizFinished ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
                    <span>Question {currentQuizIndex + 1} of {quizQuestions.length}</span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 mb-4">
                    {quizQuestions[currentQuizIndex].question}
                  </p>

                  <div className="space-y-2 mb-4">
                    {quizQuestions[currentQuizIndex].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQuizIndex] === optIdx
                      const isAnswered = selectedAnswers[currentQuizIndex] !== undefined
                      const isCorrect = optIdx === quizQuestions[currentQuizIndex].correct_answer

                      let btnClass = "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                      if (isAnswered) {
                        if (isCorrect) {
                          btnClass = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold"
                        } else if (isSelected) {
                          btnClass = "border-red-500 bg-red-50 text-red-900 font-bold"
                        } else {
                          btnClass = "border-slate-100 bg-slate-50 text-slate-400 opacity-60"
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={isAnswered}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left text-xs font-medium transition shadow-2xs ${btnClass}`}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedAnswers[currentQuizIndex] !== undefined && (
                    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900">
                      <p className="font-bold mb-1">
                        {selectedAnswers[currentQuizIndex] === quizQuestions[currentQuizIndex].correct_answer
                          ? "✓ Correct!"
                          : "✗ Incorrect"}
                      </p>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        {quizQuestions[currentQuizIndex].explanation}
                      </p>
                    </div>
                  )}

                  {selectedAnswers[currentQuizIndex] !== undefined && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleNextQuizQuestion}
                        className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                      >
                        {currentQuizIndex + 1 < quizQuestions.length
                          ? "Next Question →"
                          : "See Quiz Results →"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <span className="text-3xl">🏆</span>
                  <h4 className="mt-2 text-base font-bold text-slate-900">
                    Quiz Completed!
                  </h4>
                  {(() => {
                    const score = Object.entries(selectedAnswers).filter(
                      ([qIdx, ans]) => Number(ans) === quizQuestions[Number(qIdx)].correct_answer
                    ).length
                    return (
                      <p className="mt-1 text-sm font-semibold text-blue-600">
                        You scored {score} out of {quizQuestions.length} ({Math.round((score / quizQuestions.length) * 100)}%)
                      </p>
                    )
                  })()}

                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAnswers({})
                        setCurrentQuizIndex(0)
                        setQuizFinished(false)
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                    >
                      Retake Quiz
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuizQuestions(null)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                    >
                      Close Quiz
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 9. BOTTOM ACTIONS & SOURCE ATTRIBUTION */}
        <footer className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Generated from: {material?.title}
              </p>
              <p className="text-[11px] text-slate-400">
                Retrieved via RAG semantic passage analysis · AI-generated academic study summary
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenReader && onOpenReader(materialId)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                Ask AI About This Material 💬
              </button>

              <button
                type="button"
                disabled={regenerating}
                onClick={handleRegenerate}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
              >
                Regenerate 🔄
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default StudyPack
