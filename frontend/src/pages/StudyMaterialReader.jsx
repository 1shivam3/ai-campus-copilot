import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { askStudyMaterial, generateStudyPack, generateFlashcards, analyzeExamPaper } from "../lib/api"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function StudyMaterialReader({
  materialId,
  user,
  profile,
  onBack,
  onNavigateToSyllabus,
  onOpenStudyPack,
  onOpenFlashcards,
  onOpenExamAnalysis,
}) {
  // Document State
  const [material, setMaterial] = useState(null)
  const [matchedTopics, setMatchedTopics] = useState([])
  const [signedUrl, setSignedUrl] = useState("")
  const [hasStudyPack, setHasStudyPack] = useState(false)
  const [generatingPack, setGeneratingPack] = useState(false)
  const [flashcardCount, setFlashcardCount] = useState(0)
  const [generatingCards, setGeneratingCards] = useState(false)
  const [hasPaperAnalysis, setHasPaperAnalysis] = useState(false)
  const [analyzingPaper, setAnalyzingPaper] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Panels & UI State
  const [showExtractedText, setShowExtractedText] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [copiedAnswer, setCopiedAnswer] = useState(false)

  // AI Q&A State
  const [question, setQuestion] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiLoadingAction, setAiLoadingAction] = useState("")
  const [aiResponse, setAiResponse] = useState(null)
  const [aiError, setAiError] = useState("")

  // Explain Simply Modal / Input State
  const [explainSnippet, setExplainSnippet] = useState("")
  const [showExplainModal, setShowExplainModal] = useState(false)

  // Interactive Quiz State
  const [quizQuestions, setQuizQuestions] = useState(null)
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [quizFinished, setQuizFinished] = useState(false)

  // ---------------------------------------------------------
  // 1. LOAD DOCUMENT METADATA, TOPICS & SIGNED PDF URL
  // ---------------------------------------------------------
  useEffect(() => {
    async function loadDocument() {
      if (!materialId || !user?.id) return

      setLoading(true)
      setError("")

      try {
        // 1. Load study material details
        const { data: docData, error: docErr } = await supabase
          .from("study_materials")
          .select(`
            id,
            user_id,
            title,
            subject_id,
            unit_number,
            material_type,
            original_file_name,
            storage_path,
            extracted_text,
            extracted_character_count,
            processing_status,
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
          throw new Error("Could not find this study material or you do not have permission to view it.")
        }

        if (docData.user_id !== user.id) {
          throw new Error("Access denied. This document belongs to another user.")
        }

        setMaterial(docData)

        // 2. Load matched syllabus topics
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
          console.warn("Could not load matched topics:", topicsErr)
        }

        // 3. Check if study pack already exists
        try {
          const { data: spData } = await supabase
            .from("study_packs")
            .select("id, updated_at")
            .eq("study_material_id", Number(materialId))
            .maybeSingle()

          if (spData) {
            setHasStudyPack(true)
          }
        } catch (spErr) {
          console.warn("Study pack check note:", spErr)
        }

        // 4. Check if flashcards already exist
        try {
          const { data: fcData } = await supabase
            .from("study_flashcards")
            .select("id")
            .eq("study_material_id", Number(materialId))

          if (fcData && fcData.length > 0) {
            setFlashcardCount(fcData.length)
          }
        } catch (fcErr) {
          console.warn("Flashcards check note:", fcErr)
        }

        // 5. Check if paper analysis exists
        try {
          const { data: analData } = await supabase
            .from("exam_paper_analysis")
            .select("id, updated_at")
            .eq("study_material_id", Number(materialId))
            .maybeSingle()

          if (analData) {
            setHasPaperAnalysis(true)
          }
        } catch (analErr) {
          console.warn("Paper analysis check note:", analErr)
        }

        // 6. Generate secure temporary signed URL for PDF viewing (10 mins)
        if (docData.storage_path) {
          const { data: urlData, error: urlErr } = await supabase.storage
            .from("study-material")
            .createSignedUrl(docData.storage_path, 60 * 10)

          if (!urlErr && urlData?.signedUrl) {
            setSignedUrl(urlData.signedUrl)
          } else {
            // Fallback check
            const { data: pubData } = supabase.storage
              .from("study-material")
              .getPublicUrl(docData.storage_path)
            setSignedUrl(pubData?.publicUrl || "")
          }
        }
      } catch (err) {
        console.error("Document load error:", err)
        setError(err.message || "Could not load document.")
      } finally {
        setLoading(false)
      }
    }

    loadDocument()
  }, [materialId, user])

  // ---------------------------------------------------------
  // 2. ASK THIS MATERIAL & EXECUTE QUICK ACTIONS
  // ---------------------------------------------------------
  async function handleAskAI(customQuestion = null, actionType = "ask") {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setAiError("This feature requires an internet connection.")
      return
    }

    const query = customQuestion || question
    if (!query.trim() && actionType === "ask") return
    if (!material?.id || !user?.id) return

    setAiLoading(true)
    setAiError("")
    setQuizQuestions(null)

    const actionLabels = {
      ask: "Asking AI...",
      summarize: "Generating summary...",
      important_points: "Extracting high-yield exam points...",
      explain_simply: "Simplifying concept...",
      quiz: "Generating document practice quiz...",
    }
    setAiLoadingAction(actionLabels[actionType] || "Processing with AI...")

    try {
      const res = await askStudyMaterial({
        studyMaterialId: material.id,
        userId: user.id,
        question: query.trim() || "Analyze this document",
        actionType,
      })

      if (actionType === "quiz") {
        // Parse quiz questions JSON
        try {
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
            setAiResponse({
              type: "quiz",
              title: `Practice Quiz (${quizData.questions.length} Questions)`,
              content: null,
            })
          } else {
            throw new Error("Invalid quiz format received.")
          }
        } catch (quizErr) {
          console.warn("Quiz parse note:", quizErr)
          setAiResponse({
            type: "quiz",
            title: "Document Practice Questions",
            content: res.answer,
          })
        }
      } else {
        const titles = {
          ask: `Answer for: "${query}"`,
          summarize: "📌 Comprehensive Revision Summary",
          important_points: "🎯 High-Yield Exam Points & Pitfalls",
          explain_simply: `💡 Simplified Explanation: "${query}"`,
        }

        setAiResponse({
          type: actionType,
          title: titles[actionType] || "AI Response",
          content: res.answer,
          sources: res.sources || [],
          confidence: res.confidence || "moderate",
        })
      }

      if (actionType === "ask") {
        setQuestion("")
      }
    } catch (err) {
      console.error("AI Question error:", err)
      setAiError(err.message || "Could not generate answer for this study material.")
    } finally {
      setAiLoading(false)
      setAiLoadingAction("")
    }
  }

  // ---------------------------------------------------------
  // 3. COPY UTILITIES
  // ---------------------------------------------------------
  function handleCopyExtractedText() {
    if (!material?.extracted_text) return
    navigator.clipboard.writeText(material.extracted_text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2000)
  }

  function handleCopyAnswer() {
    if (!aiResponse?.content) return
    navigator.clipboard.writeText(aiResponse.content)
    setCopiedAnswer(true)
    setTimeout(() => setCopiedAnswer(false), 2000)
  }

  // ---------------------------------------------------------
  // 4. INTERACTIVE QUIZ OPTION SELECT
  // ---------------------------------------------------------
  function handleSelectOption(optionIndex) {
    if (selectedAnswers[currentQuizIndex] !== undefined) return // Already answered
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

  // ---------------------------------------------------------
  // 5. DYNAMIC SUGGESTED QUESTIONS
  // ---------------------------------------------------------
  const firstTopicName = matchedTopics[0]?.syllabus_topics?.topic_name
  const suggestedQuestions = [
    "Explain the most important concept in this document.",
    "What are the high-yield topics likely to appear in an exam?",
    firstTopicName
      ? `Explain ${firstTopicName} with an intuitive code or practical example.`
      : "Explain the key definitions and formulas in these notes.",
    "What are common conceptual mistakes students make on this topic?",
  ]

  // Render Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-40 animate-pulse rounded-xl bg-slate-200 mb-6" />
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="h-[600px] animate-pulse rounded-3xl bg-white border border-slate-200 lg:col-span-7" />
            <div className="h-[600px] animate-pulse rounded-3xl bg-white border border-slate-200 lg:col-span-5" />
          </div>
        </div>
      </div>
    )
  }

  // Render Error State
  if (error || !material) {
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
            message={error || "Could not open this study material."}
            onRetry={onBack}
          />
        </div>
      </div>
    )
  }

  const subjectCode = material.academic_subjects?.subject_code
  const subjectLabel =
    material.academic_subjects?.subject_name ||
    (subjectCode ? `${subjectCode} Course Material` : "Academic Course Material")

  const formattedDate = material.created_at
    ? new Date(material.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently"

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Top Navigation & Document Title Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="mb-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
            >
              ← Back to Study Material Library
            </button>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {material.title}
            </h1>

            {/* Metadata Pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">
                📘 {subjectLabel} {subjectCode ? `(${subjectCode})` : ""}
              </span>

              {material.unit_number && (
                <span className="rounded-full bg-purple-50 px-2.5 py-1 font-bold text-purple-700">
                  Unit {material.unit_number}
                </span>
              )}

              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                {material.material_type}
              </span>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                {(material.extracted_character_count || 0).toLocaleString()} chars
              </span>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  material.processing_status === "processed"
                    ? "bg-emerald-50 text-emerald-700"
                    : material.processing_status === "failed"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {material.processing_status === "processed"
                  ? "✓ Processed"
                  : material.processing_status === "failed"
                    ? "⚠️ Unreadable Text"
                    : "📁 Uploaded"}
              </span>

              <span className="text-[11px] text-slate-400">📅 {formattedDate}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {signedUrl && (
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-xs"
              >
                <span>Open in New Tab</span>
                <span className="text-[10px]">↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* ========================================================= */}
          {/* LEFT COLUMN: PDF VIEWER & EXTRACTED TEXT PANEL */}
          {/* ========================================================= */}
          <div className="space-y-6 lg:col-span-7">
            {/* PDF Viewer Card */}
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  PDF VIEWER
                </span>
                <span className="truncate font-mono text-[11px] text-slate-400 max-w-xs">
                  {material.original_file_name}
                </span>
              </div>

              {signedUrl ? (
                <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 shadow-inner h-[520px] sm:h-[680px]">
                  <iframe
                    src={`${signedUrl}#toolbar=0&navpanes=0`}
                    title={material.title}
                    className="h-full w-full border-0"
                  />
                </div>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center p-6 text-center text-slate-400">
                  <p className="text-sm font-semibold">Could not load preview stream.</p>
                  <p className="mt-1 text-xs">
                    Please use the "Open in New Tab" link above.
                  </p>
                </div>
              )}
            </div>

            {/* Extracted Text Collapsible Panel */}
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition">
              <button
                type="button"
                onClick={() => setShowExtractedText(!showExtractedText)}
                className="flex w-full items-center justify-between p-5 text-left hover:bg-slate-50/70 transition"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                    📝
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Extracted Text Content
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {(material.extracted_character_count || 0).toLocaleString()} characters indexed
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    {showExtractedText ? "Hide ▲" : "Expand ▼"}
                  </span>
                </div>
              </button>

              {showExtractedText && (
                <div className="border-t border-slate-100 p-5 pt-3 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      READABLE EXTRACTED CORPUS
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyExtractedText}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      {copiedText ? "✓ Copied!" : "Copy Text"}
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap selection:bg-blue-100">
                    {material.extracted_text || "No text could be extracted from this PDF document."}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: ASK THIS MATERIAL & DOCUMENT ACTIONS */}
          {/* ========================================================= */}
          <div className="space-y-6 lg:col-span-5">
            {/* AI STUDY PACK WIDGET CARD */}
            <div className="rounded-3xl border border-purple-200/80 bg-linear-to-br from-purple-50/70 via-white to-purple-50/30 p-5 shadow-sm transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-600 text-white text-base font-bold shadow-xs">
                    📦
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                      AI STUDY PACK
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {hasStudyPack ? "Study Pack Ready" : "Turn this document into a study pack"}
                    </h3>
                  </div>
                </div>

                {hasStudyPack ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenStudyPack && onOpenStudyPack(material.id)}
                      className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition active:scale-[0.98]"
                    >
                      View Pack →
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={generatingPack}
                    onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.onLine === false) {
                        setAiError("This feature requires an internet connection.")
                        return
                      }
                      setGeneratingPack(true)
                      setAiError("")
                      try {
                        await generateStudyPack({
                          studyMaterialId: material.id,
                          userId: user.id,
                          forceRegenerate: false,
                        })
                        setHasStudyPack(true)
                        if (onOpenStudyPack) onOpenStudyPack(material.id)
                      } catch (e) {
                        console.error("Study pack generation error:", e)
                        setAiError(e.message || "Failed to generate study pack. Please try again.")
                      } finally {
                        setGeneratingPack(false)
                      }
                    }}
                    className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition disabled:opacity-50 active:scale-[0.98]"
                  >
                    {generatingPack ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Pack 📦"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* AI FLASHCARDS WIDGET CARD */}
            <div className="rounded-3xl border border-indigo-200/80 bg-linear-to-br from-indigo-50/70 via-white to-indigo-50/30 p-5 shadow-sm transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white text-base font-bold shadow-xs">
                    🎴
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      AI FLASHCARDS
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {flashcardCount > 0
                        ? `${flashcardCount} Flashcards Ready`
                        : "Turn this document into flashcards"}
                    </h3>
                  </div>
                </div>

                {flashcardCount > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenFlashcards && onOpenFlashcards(material.id)}
                      className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition active:scale-[0.98]"
                    >
                      Study Flashcards →
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={generatingCards}
                    onClick={async () => {
                      if (typeof navigator !== "undefined" && navigator.onLine === false) {
                        setAiError("This feature requires an internet connection.")
                        return
                      }
                      setGeneratingCards(true)
                      setAiError("")
                      try {
                        const res = await generateFlashcards({
                          studyMaterialId: material.id,
                          userId: user.id,
                          count: 15,
                          forceRegenerate: false,
                        })
                        if (res?.flashcards) {
                          setFlashcardCount(res.flashcards.length)
                          if (onOpenFlashcards) onOpenFlashcards(material.id)
                        }
                      } catch (e) {
                        console.error("Flashcards generation error:", e)
                        setAiError(e.message || "Failed to generate flashcards. Please try again.")
                      } finally {
                        setGeneratingCards(false)
                      }
                    }}
                    className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50 active:scale-[0.98]"
                  >
                    {generatingCards ? (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Flashcards 🎴"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* PREVIOUS-YEAR PAPER ANALYSIS WIDGET (for Question Papers) */}
            {material?.material_type === "Previous Year Paper" && (
              <div className="rounded-3xl border border-emerald-200/80 bg-linear-to-br from-emerald-50/70 via-white to-emerald-50/30 p-5 shadow-sm transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white text-base font-bold shadow-xs">
                      📊
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        QUESTION PAPER ANALYSIS
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        {hasPaperAnalysis
                          ? "Question Paper Analysis Ready"
                          : "Extract frequent topics & question patterns"}
                      </h3>
                    </div>
                  </div>

                  {hasPaperAnalysis ? (
                    <button
                      type="button"
                      onClick={() => onOpenExamAnalysis && onOpenExamAnalysis(material.id)}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition active:scale-[0.98]"
                    >
                      View Analysis →
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={analyzingPaper}
                      onClick={async () => {
                        if (typeof navigator !== "undefined" && navigator.onLine === false) {
                          setAiError("This feature requires an internet connection.")
                          return
                        }
                        setAnalyzingPaper(true)
                        setAiError("")
                        try {
                          await analyzeExamPaper({
                            studyMaterialId: material.id,
                            userId: user.id,
                            forceRegenerate: false,
                          })
                          setHasPaperAnalysis(true)
                          if (onOpenExamAnalysis) onOpenExamAnalysis(material.id)
                        } catch (e) {
                          console.error("Paper analysis error:", e)
                          setAiError(e.message || "The question paper analysis could not be completed.")
                        } finally {
                          setAnalyzingPaper(false)
                        }
                      }}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 active:scale-[0.98]"
                    >
                      {analyzingPaper ? (
                        <span className="flex items-center gap-1">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Analyzing...
                        </span>
                      ) : (
                        "Analyze Paper 📊"
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ASK THIS MATERIAL CARD */}
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs">
                  ✨
                </span>
                <div>
                  <h2 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                    ASK THIS MATERIAL
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Answers are strictly grounded in this document's content.
                  </p>
                </div>
              </div>

              {/* Question Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleAskAI(question, "ask")
                }}
                className="mt-3"
              >
                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder="Ask a question about this document... (e.g. Explain linked lists in simple language)"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={aiLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleAskAI(question, "ask")
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/10 disabled:opacity-50 resize-none"
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Press Enter ↵ to ask
                    </span>

                    <button
                      type="submit"
                      disabled={aiLoading || !question.trim()}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98]"
                    >
                      {aiLoading ? "Asking AI..." : "Ask AI →"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Suggested Questions Pills */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  SUGGESTED QUESTIONS
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedQuestions.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleAskAI(sq, "ask")}
                      className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700 transition disabled:opacity-50"
                    >
                      💬 {sq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  DOCUMENT ACTIONS
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleAskAI("Summarize this document", "summarize")}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50/50 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>📑</span>
                    <span>Summarize</span>
                  </button>

                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => setShowExplainModal(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50/50 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>💡</span>
                    <span>Explain Simply</span>
                  </button>

                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleAskAI("Extract important points", "important_points")}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50/50 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>🎯</span>
                    <span>Important Points</span>
                  </button>

                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => handleAskAI("Generate document quiz", "quiz")}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span>📝</span>
                    <span>Generate Quiz</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AI LOADING SPINNER */}
            {aiLoading && (
              <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-6 text-center text-blue-800 shadow-xs animate-pulse">
                <div className="mx-auto mb-2.5 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <p className="text-xs font-bold">{aiLoadingAction || "Analyzing study material..."}</p>
                <p className="mt-0.5 text-[11px] text-blue-600">Grounded in "{material.title}"</p>
              </div>
            )}

            {/* AI ERROR BANNER */}
            {aiError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                ⚠️ {aiError}
              </div>
            )}

            {/* INTERACTIVE DOCUMENT QUIZ VIEWER */}
            {quizQuestions && quizQuestions.length > 0 && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                      PRACTICE QUIZ
                    </span>
                    <h3 className="mt-1 text-sm sm:text-base font-bold text-slate-900">
                      Source: {material.title}
                    </h3>
                  </div>

                  {!quizFinished && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-bold text-slate-700">
                      Question {currentQuizIndex + 1} of {quizQuestions.length}
                    </span>
                  )}
                </div>

                {!quizFinished ? (
                  <div>
                    {/* Current Question */}
                    <p className="text-xs sm:text-sm font-bold text-slate-900 mb-4 leading-snug">
                      {quizQuestions[currentQuizIndex].question}
                    </p>

                    {/* Options List */}
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

                    {/* Feedback & Explanation */}
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

                    {/* Next Question Button */}
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
                  // Quiz Finished Summary Screen
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

            {/* AI TEXT RESPONSE CARD */}
            {aiResponse && aiResponse.content && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {aiResponse.title}
                    </h3>
                    {aiResponse.confidence && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          aiResponse.confidence === "strong"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : aiResponse.confidence === "moderate"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {aiResponse.confidence === "strong"
                          ? "🟢 Strong source match"
                          : aiResponse.confidence === "moderate"
                            ? "🔵 Moderate source match"
                            : "🟡 Weak source match"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyAnswer}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    {copiedAnswer ? "✓ Copied!" : "Copy"}
                  </button>
                </div>

                <div className="prose prose-sm max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans selection:bg-blue-100">
                  {aiResponse.content}
                </div>

                {/* Sources from your material */}
                {aiResponse.sources && aiResponse.sources.length > 0 && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Sources from your material
                    </p>
                    <div className="space-y-2">
                      {aiResponse.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                            <span className="flex items-center gap-1.5">
                              <span>📄</span>
                              <span>Page {src.page_number}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 font-normal">
                              {Math.round(src.similarity * 100)}% relevance
                            </span>
                          </div>
                          {src.content_preview && (
                            <p className="text-[11px] text-slate-600 font-mono line-clamp-2">
                              "{src.content_preview}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* EXPLAIN SIMPLY MODAL */}
        {showExplainModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                💡 Explain Concept Simply
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Paste or type any snippet or topic from the document to generate an intuitive analogy.
              </p>

              <textarea
                rows={4}
                placeholder="Paste the text or topic name you want explained simply (e.g. Inverted Index vs Forward Index)"
                value={explainSnippet}
                onChange={(e) => setExplainSnippet(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 p-3.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExplainModal(false)
                    setExplainSnippet("")
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!explainSnippet.trim()}
                  onClick={() => {
                    setShowExplainModal(false)
                    handleAskAI(explainSnippet, "explain_simply")
                    setExplainSnippet("")
                  }}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Explain Concept →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterialReader
