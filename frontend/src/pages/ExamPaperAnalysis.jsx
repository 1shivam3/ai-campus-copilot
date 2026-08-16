import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { analyzeExamPaper, askStudyMaterial } from "../lib/api"
import ErrorState from "../components/ErrorState"

function ExamPaperAnalysis({
  materialId,
  user,
  profile,
  onBack,
  onOpenReader,
  onOpenExamMode,
  onOpenStudyPack,
}) {
  // Paper & Analysis State
  const [material, setMaterial] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [syllabusTopics, setSyllabusTopics] = useState([])
  const [topicProgressMap, setTopicProgressMap] = useState({})
  const [otherPapers, setOtherPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Inline Practice Questions State
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [practiceQuestions, setPracticeQuestions] = useState(null)
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [quizFinished, setQuizFinished] = useState(false)

  // ---------------------------------------------------------
  // 1. LOAD PAPER, ANALYSIS & SYLLABUS MASTERY CONTEXT
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadData() {
      if (!materialId || !user?.id) return

      setLoading(true)
      setError("")

      try {
        // 1. Fetch Question Paper Document Metadata
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
          throw new Error("Could not find this question paper.")
        }

        if (docData.user_id !== user.id) {
          throw new Error("Access denied. You do not own this document.")
        }

        setMaterial(docData)

        // 2. Fetch Syllabus Topics & Student Topic Progress for this Subject
        if (docData.subject_id) {
          try {
            const { data: topicsData } = await supabase
              .from("syllabus_topics")
              .select("id, topic_name, unit_number")
              .eq("subject_id", docData.subject_id)

            setSyllabusTopics(topicsData || [])

            const topicIds = (topicsData || []).map((t) => t.id)
            if (topicIds.length > 0) {
              const { data: progData } = await supabase
                .from("student_topic_progress")
                .select("syllabus_topic_id, mastery_score, status")
                .eq("user_id", user.id)
                .in("syllabus_topic_id", topicIds)

              const map = {}
              ;(progData || []).forEach((p) => {
                map[p.syllabus_topic_id] = p.mastery_score || 0
              })
              setTopicProgressMap(map)
            }
          } catch (topErr) {
            console.warn("Syllabus mastery fetch note:", topErr)
          }

          // 3. Query other uploaded Previous-Year Papers for comparison
          try {
            const { data: papersData } = await supabase
              .from("study_materials")
              .select("id, title, created_at")
              .eq("user_id", user.id)
              .eq("subject_id", docData.subject_id)
              .eq("material_type", "Previous Year Paper")
              .neq("id", docData.id)

            setOtherPapers(papersData || [])
          } catch (papersErr) {
            console.warn("Other papers fetch note:", papersErr)
          }
        }

        // 4. Generate or fetch cached analysis
        const res = await analyzeExamPaper({
          studyMaterialId: materialId,
          userId: user.id,
          forceRegenerate: false,
        })

        if (res?.analysis) {
          setAnalysis(res.analysis)
        } else {
          throw new Error("Paper analysis could not be completed.")
        }
      } catch (err) {
        console.error("Exam Paper Analysis error:", err)
        setError(err.message || "The question paper is safely uploaded, but analysis could not be completed.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [materialId, user])

  // ---------------------------------------------------------
  // 2. REGENERATE ANALYSIS
  // ---------------------------------------------------------
  async function handleRegenerate() {
    if (!materialId || !user?.id) return

    setRegenerating(true)
    setError("")
    setSuccessMsg("")

    try {
      const res = await analyzeExamPaper({
        studyMaterialId: materialId,
        userId: user.id,
        forceRegenerate: true,
      })

      if (res?.analysis) {
        setAnalysis(res.analysis)
        setSuccessMsg("✓ Question paper analyzed successfully with updated frequencies!")
      }
    } catch (err) {
      console.error("Regenerate error:", err)
      setError("Analysis regeneration failed. Please try again.")
    } finally {
      setRegenerating(false)
    }
  }

  // ---------------------------------------------------------
  // 3. GENERATE PRACTICE QUESTIONS (Ground in frequent topics)
  // ---------------------------------------------------------
  async function handlePracticeQuestions() {
    if (!materialId || !user?.id) return

    setPracticeLoading(true)
    setError("")

    try {
      const res = await askStudyMaterial({
        studyMaterialId: materialId,
        userId: user.id,
        question: "Generate practice exam questions testing the frequently tested concepts in this paper",
        actionType: "quiz",
      })

      let cleanStr = (res.answer || "").trim()
      if (cleanStr.startsWith("```json")) cleanStr = cleanStr.slice(7)
      if (cleanStr.startsWith("```")) cleanStr = cleanStr.slice(3)
      if (cleanStr.endsWith("```")) cleanStr = cleanStr.slice(0, -3)
      const quizData = JSON.parse(cleanStr.trim())

      if (quizData?.questions && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
        setPracticeQuestions(quizData.questions)
        setCurrentQIndex(0)
        setSelectedAnswers({})
        setQuizFinished(false)

        setTimeout(() => {
          document.getElementById("exam-paper-practice-section")?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      } else {
        throw new Error("Invalid practice questions format.")
      }
    } catch (err) {
      console.error("Practice questions error:", err)
      setError("Could not generate practice questions from this paper.")
    } finally {
      setPracticeLoading(false)
    }
  }

  // ---------------------------------------------------------
  // 4. HELPER: MATCH TOPIC WITH SYLLABUS & COMPUTE PRIORITY
  // ---------------------------------------------------------
  function getTopicMasteryAndPriority(topicName, questionCount, maxCount) {
    if (!topicName) return { matchedTopic: null, mastery: null, priorityLabel: "High", priorityScore: 75 }

    const clean = topicName.toLowerCase().trim()
    const matched = syllabusTopics.find(
      (st) => st.topic_name.toLowerCase().includes(clean) || clean.includes(st.topic_name.toLowerCase())
    )

    const mastery = matched && topicProgressMap[matched.id] !== undefined ? topicProgressMap[matched.id] : null

    // Deterministic combination:
    // frequency_score (0-100) + weakness_score (0-100)
    const freqScore = maxCount > 0 ? (questionCount / maxCount) * 100 : 70
    const weaknessScore = mastery !== null ? 100 - mastery : 60
    const priorityScore = Math.round(0.6 * freqScore + 0.4 * weaknessScore)

    let priorityLabel = "Moderate Priority"
    let badgeClass = "bg-blue-50 text-blue-700 border-blue-200"

    if (priorityScore >= 80) {
      priorityLabel = "Critical Priority"
      badgeClass = "bg-red-50 text-red-700 border-red-200"
    } else if (priorityScore >= 60) {
      priorityLabel = "High Priority"
      badgeClass = "bg-amber-50 text-amber-800 border-amber-200"
    }

    return { matchedTopic: matched, mastery, priorityLabel, priorityScore, badgeClass }
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-44 animate-pulse rounded-3xl bg-white border border-slate-200" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="h-64 animate-pulse rounded-3xl bg-white border border-slate-200" />
            <div className="h-64 animate-pulse rounded-3xl bg-white border border-slate-200" />
          </div>
        </div>
      </div>
    )
  }

  // Error State
  if (error && !analysis) {
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
            message={error || "The question paper is safely uploaded, but analysis could not be completed."}
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

  const maxQCount =
    analysis?.topic_frequency && analysis.topic_frequency.length > 0
      ? Math.max(...analysis.topic_frequency.map((t) => t.question_count || 1))
      : 1

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
          >
            ← Back to Study Material Library
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              {regenerating ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
                  Analyzing...
                </span>
              ) : (
                <span>Re-Analyze Paper 🔄</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onOpenExamMode && onOpenExamMode()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-xs"
            >
              <span>Use in Exam Mode 🎯</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenReader && onOpenReader(materialId)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
            >
              <span>View Paper in Reader ↗</span>
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
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              📊 PREVIOUS YEAR PAPER ANALYSIS
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              📘 {subjectLabel} {subjectCode ? `(${subjectCode})` : ""}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {material?.material_type || "Question Paper"}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {material?.title || "University Examination Paper"}
          </h1>

          <p className="mt-1 text-xs text-slate-500 font-medium">
            Based on the uploaded question paper · Identifies observed question patterns and revision priorities
          </p>

          {/* Key Metrics Row */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                TOTAL QUESTIONS
              </p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                {analysis?.total_questions || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                UNITS COVERED
              </p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-0.5">
                {analysis?.detected_units?.length || "—"} Units
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                FREQUENT TOPICS
              </p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">
                {analysis?.topic_frequency?.length || 0} Identified
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                REPEATED CONCEPTS
              </p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 mt-0.5">
                {analysis?.repeated_topics?.length || 0} Topics
              </p>
            </div>
          </div>
        </header>

        {/* 2-COLUMN MAIN CONTENT GRID */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* LEFT COLUMN: FREQUENT TOPICS & REVISION PRIORITIES (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 1. MOST FREQUENT TOPICS & SYLLABUS MASTERY */}
            <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 font-bold text-sm">
                    📈
                  </span>
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                    Most Frequent Topics
                  </h2>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">
                  Frequency + Mastery
                </span>
              </div>

              {analysis?.topic_frequency && analysis.topic_frequency.length > 0 ? (
                <div className="space-y-3">
                  {analysis.topic_frequency.map((item, idx) => {
                    const { matchedTopic, mastery, priorityLabel, priorityScore, badgeClass } =
                      getTopicMasteryAndPriority(item.topic, item.question_count, maxQCount)

                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <h3 className="font-bold text-sm text-slate-900">
                              {item.topic}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                              <span>{item.question_count} questions</span>
                              {item.percentage && <span>({item.percentage}%)</span>}
                              {matchedTopic ? (
                                <span className="text-emerald-700 font-semibold text-[11px]">
                                  • Mapped syllabus topic ✓
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">
                                  • Possible syllabus match
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                          >
                            {priorityLabel}
                          </span>
                        </div>

                        {/* Mastery & Frequency Bars */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 mt-2 text-xs">
                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span>Paper Frequency:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {item.question_count} Qs
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{
                                  width: `${Math.min(100, (item.question_count / maxQCount) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                              <span>Your Mastery:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {mastery !== null ? `${mastery}%` : "Not tracked"}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full bg-blue-600 rounded-full"
                                style={{
                                  width: `${mastery !== null ? mastery : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No specific topic frequencies identified.</p>
              )}
            </section>

            {/* 2. REVISION PRIORITIES */}
            {analysis?.revision_priorities && analysis.revision_priorities.length > 0 && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700 font-bold text-sm">
                      🎯
                    </span>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                      Recommended Revision Priorities
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handlePracticeQuestions}
                    className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-2xs"
                  >
                    Start Revision →
                  </button>
                </div>

                <div className="space-y-2.5">
                  {analysis.revision_priorities.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-3.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-mono text-[10px] font-bold text-amber-900 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {item.topic}
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            {item.reason}
                          </p>
                        </div>
                      </div>

                      {item.priority && (
                        <span className="font-mono text-xs font-bold text-amber-800 shrink-0">
                          Priority {item.priority}/10
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. COMPARE MULTIPLE PREVIOUS YEAR PAPERS */}
            {otherPapers.length > 0 && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm">
                    ⚖️
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">
                      Compare Question Papers
                    </h2>
                    <p className="text-xs text-slate-400">
                      {otherPapers.length + 1} previous-year papers uploaded for {subjectLabel}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 pr-4">Frequent Topic</th>
                        <th className="py-2.5 px-3">This Paper</th>
                        <th className="py-2.5 px-3">Repeated Signal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {(analysis?.topic_frequency || []).slice(0, 5).map((tf, i) => (
                        <tr key={i}>
                          <td className="py-2.5 pr-4 font-bold text-slate-900">{tf.topic}</td>
                          <td className="py-2.5 px-3 font-mono">{tf.question_count} Qs</td>
                          <td className="py-2.5 px-3">
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                              High Yield Across Years
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: UNIT DISTRIBUTION, PATTERNS & DIFFICULTY (5 cols) */}
          <div className="space-y-6 lg:col-span-5">
            {/* 4. UNIT-WISE QUESTION DISTRIBUTION */}
            {analysis?.detected_units && analysis.detected_units.length > 0 && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-sm">
                    🏛️
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Unit Distribution
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {analysis.detected_units.map((u, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                    >
                      <span className="font-bold text-slate-800">
                        Unit {u.unit}
                      </span>
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                        {u.question_count} {u.question_count === 1 ? "question" : "questions"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. REPEATED CONCEPTS */}
            {analysis?.repeated_topics && analysis.repeated_topics.length > 0 && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-700 font-bold text-sm">
                    🔁
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Repeated Concepts
                  </h2>
                </div>

                <div className="space-y-2">
                  {analysis.repeated_topics.map((rt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50/40 p-3 text-xs"
                    >
                      <span className="font-bold text-slate-900">{rt.topic}</span>
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 font-bold text-purple-800 text-[11px]">
                        Appeared {rt.appearances} {rt.appearances === 1 ? "time" : "times"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 6. QUESTION PATTERNS */}
            {analysis?.question_patterns && analysis.question_patterns.length > 0 && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-sm">
                    🧩
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Question Patterns
                  </h2>
                </div>

                <div className="space-y-2">
                  {analysis.question_patterns.map((qp, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                    >
                      <p className="font-bold text-slate-900">{qp.pattern}</p>
                      {qp.count && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Observed {qp.count} times in paper
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 7. DIFFICULTY ESTIMATE */}
            {analysis?.difficulty_distribution && (
              <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-sm">
                    ⚖️
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Difficulty Breakdown
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-2.5">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">Easy</p>
                    <p className="text-lg font-bold text-emerald-900 mt-0.5">
                      {analysis.difficulty_distribution.easy || 0}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-2.5">
                    <p className="text-[10px] font-bold text-blue-700 uppercase">Medium</p>
                    <p className="text-lg font-bold text-blue-900 mt-0.5">
                      {analysis.difficulty_distribution.medium || 0}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-2.5">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">Hard</p>
                    <p className="text-lg font-bold text-rose-900 mt-0.5">
                      {analysis.difficulty_distribution.hard || 0}
                    </p>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* 8. PRACTICE QUESTIONS GENERATOR FROM THIS PAPER */}
        <section
          id="exam-paper-practice-section"
          className="rounded-3xl border border-emerald-200/80 bg-white p-6 sm:p-7 shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                EXAM SIMULATION
              </span>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Practice Questions Derived from This Paper
              </h2>
              <p className="text-xs text-slate-500">
                Generates fresh questions targeting the paper's frequently tested topics and question patterns.
              </p>
            </div>

            {!practiceQuestions && (
              <button
                type="button"
                disabled={practiceLoading}
                onClick={handlePracticeQuestions}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {practiceLoading ? "Generating Questions..." : "Practice These Questions →"}
              </button>
            )}
          </div>

          {practiceQuestions && practiceQuestions.length > 0 && (
            <div className="mt-4">
              {!quizFinished ? (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-3">
                    <span>Question {currentQIndex + 1} of {practiceQuestions.length}</span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 mb-4">
                    {practiceQuestions[currentQIndex].question}
                  </p>

                  <div className="space-y-2 mb-4">
                    {practiceQuestions[currentQIndex].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQIndex] === optIdx
                      const isAnswered = selectedAnswers[currentQIndex] !== undefined
                      const isCorrect = optIdx === practiceQuestions[currentQIndex].correct_answer

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
                          onClick={() => {
                            if (selectedAnswers[currentQIndex] !== undefined) return
                            setSelectedAnswers((prev) => ({
                              ...prev,
                              [currentQIndex]: optIdx,
                            }))
                          }}
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

                  {selectedAnswers[currentQIndex] !== undefined && (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
                      <p className="font-bold mb-1">
                        {selectedAnswers[currentQIndex] === practiceQuestions[currentQIndex].correct_answer
                          ? "✓ Correct Answer!"
                          : "✗ Review this concept"}
                      </p>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        {practiceQuestions[currentQIndex].explanation}
                      </p>
                    </div>
                  )}

                  {selectedAnswers[currentQIndex] !== undefined && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentQIndex + 1 < practiceQuestions.length) {
                            setCurrentQIndex((prev) => prev + 1)
                          } else {
                            setQuizFinished(true)
                          }
                        }}
                        className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                      >
                        {currentQIndex + 1 < practiceQuestions.length
                          ? "Next Question →"
                          : "See Practice Results →"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <span className="text-3xl">🏆</span>
                  <h4 className="mt-2 text-base font-bold text-slate-900">
                    Practice Completed!
                  </h4>
                  {(() => {
                    const score = Object.entries(selectedAnswers).filter(
                      ([qIdx, ans]) => Number(ans) === practiceQuestions[Number(qIdx)].correct_answer
                    ).length
                    return (
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        You scored {score} out of {practiceQuestions.length} ({Math.round((score / practiceQuestions.length) * 100)}%)
                      </p>
                    )
                  })()}

                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAnswers({})
                        setCurrentQIndex(0)
                        setQuizFinished(false)
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
                    >
                      Retake Questions
                    </button>
                    <button
                      type="button"
                      onClick={() => setPracticeQuestions(null)}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                    >
                      Close Practice
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 9. ATTRIBUTION & SAFE NOTICE FOOTER */}
        <footer className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">
                Analysis Source: {material?.title}
              </p>
              <p className="text-[11px] text-slate-400">
                Grounded strictly in the uploaded paper text · Does not predict exact future examination questions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenExamMode && onOpenExamMode()}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              >
                Open Exam Mode 🎯
              </button>

              <button
                type="button"
                onClick={() => onOpenReader && onOpenReader(materialId)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
              >
                Ask AI About Paper 💬
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default ExamPaperAnalysis
