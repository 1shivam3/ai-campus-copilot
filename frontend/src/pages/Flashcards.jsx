import { useEffect, useState, useCallback } from "react"
import { supabase } from "../lib/supabase"
import { generateFlashcards, reviewFlashcard } from "../lib/api"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

const COUNT_OPTIONS = [10, 15, 20, 30]

function Flashcards({ materialId, user, profile, onBack, onOpenReader }) {
  // Document & Deck State
  const [material, setMaterial] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Deck Interaction State
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [selectedCount, setSelectedCount] = useState(15)
  const [filterDueOnly, setFilterDueOnly] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [cardRatings, setCardRatings] = useState({})

  // ---------------------------------------------------------
  // 1. LOAD MATERIAL & FLASHCARDS
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

        // 2. Fetch or generate flashcards
        const res = await generateFlashcards({
          studyMaterialId: materialId,
          userId: user.id,
          count: selectedCount,
          forceRegenerate: false,
        })

        if (res?.flashcards) {
          setCards(res.flashcards)
          setCurrentIndex(0)
          setShowAnswer(false)
        }
      } catch (err) {
        console.error("Flashcards load error:", err)
        setError(err.message || "Flashcard generation failed. Your study material is still safe.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [materialId, user])

  // ---------------------------------------------------------
  // 2. REGENERATE FLASHCARD DECK
  // ---------------------------------------------------------
  async function handleRegenerate(countToUse = selectedCount) {
    if (!materialId || !user?.id) return

    setRegenerating(true)
    setError("")
    setSuccessMsg("")

    try {
      const res = await generateFlashcards({
        studyMaterialId: materialId,
        userId: user.id,
        count: countToUse,
        forceRegenerate: true,
      })

      if (res?.flashcards && res.flashcards.length > 0) {
        setCards(res.flashcards)
        setCurrentIndex(0)
        setShowAnswer(false)
        setCardRatings({})
        setSuccessMsg(`✓ Generated ${res.flashcards.length} new flashcards from document!`)
      } else {
        throw new Error("No flashcards could be generated from this document.")
      }
    } catch (err) {
      console.error("Regenerate error:", err)
      setError("Flashcard generation failed. Please try again.")
    } finally {
      setRegenerating(false)
    }
  }

  // ---------------------------------------------------------
  // 3. RECORD SPACED REPETITION RATING
  // ---------------------------------------------------------
  async function handleRating(rating) {
    const currentCard = activeCards[currentIndex]
    if (!currentCard?.id || !user?.id) return

    setRatingSubmitting(true)

    try {
      const res = await reviewFlashcard({
        flashcardId: currentCard.id,
        userId: user.id,
        rating,
      })

      // Update local card review count and rating
      setCardRatings((prev) => ({
        ...prev,
        [currentCard.id]: rating,
      }))

      setCards((prev) =>
        prev.map((c) =>
          c.id === currentCard.id
            ? { ...c, review_count: res.review_count, next_review_at: res.next_review_at }
            : c
        )
      )

      // Automatically advance to next card after brief delay
      setTimeout(() => {
        if (currentIndex + 1 < activeCards.length) {
          setCurrentIndex((prev) => prev + 1)
          setShowAnswer(false)
        }
      }, 300)
    } catch (err) {
      console.error("Review rating error:", err)
    } finally {
      setRatingSubmitting(false)
    }
  }

  // ---------------------------------------------------------
  // 4. KEYBOARD NAVIGATION
  // ---------------------------------------------------------
  const handleKeyDown = useCallback(
    (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        setShowAnswer((prev) => !prev)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        if (currentIndex + 1 < activeCards.length) {
          setCurrentIndex((prev) => prev + 1)
          setShowAnswer(false)
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1)
          setShowAnswer(false)
        }
      } else if (showAnswer) {
        if (e.key === "1") handleRating("again")
        if (e.key === "2") handleRating("hard")
        if (e.key === "3") handleRating("good")
        if (e.key === "4") handleRating("easy")
      }
    },
    [currentIndex, showAnswer]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Filter due cards
  const nowIso = new Date().toISOString()
  const dueCards = cards.filter(
    (c) => !c.next_review_at || new Date(c.next_review_at) <= new Date()
  )

  const activeCards = filterDueOnly ? dueCards : cards
  const currentCard = activeCards[currentIndex]

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-96 animate-pulse rounded-3xl bg-white border border-slate-200" />
        </div>
      </div>
    )
  }

  // Error / Empty State
  if (error && (!cards || cards.length === 0)) {
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
            message={error || "No flashcards available for this document."}
            onRetry={() => handleRegenerate(15)}
          />
        </div>
      </div>
    )
  }

  const subjectLabel =
    material?.academic_subjects?.subject_name ||
    (material?.subject_id ? `Subject #${material.subject_id}` : "Academic Subject")
  const subjectCode = material?.academic_subjects?.subject_code

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Top Header & Navigation */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
            >
              ← Back to Study Material Library
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
              {material?.title || "Flashcards"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-bold text-blue-700">
                📘 {subjectLabel} {subjectCode ? `(${subjectCode})` : ""}
              </span>
              {material?.unit_number && (
                <span className="rounded-full bg-purple-50 px-2 py-0.5 font-bold text-purple-700">
                  Unit {material.unit_number}
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                {cards.length} Flashcards
              </span>
              {dueCards.length > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-bold text-amber-700 border border-amber-200">
                  {dueCards.length} Due for Review
                </span>
              )}
            </div>
          </div>

          {/* Regeneration & Count Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCount}
              onChange={(e) => {
                const c = Number(e.target.value)
                setSelectedCount(c)
                handleRegenerate(c)
              }}
              disabled={regenerating}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none transition shadow-2xs"
            >
              {COUNT_OPTIONS.map((num) => (
                <option key={num} value={num}>
                  {num} cards
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={regenerating}
              onClick={() => handleRegenerate(selectedCount)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              {regenerating ? (
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
                  Generating...
                </span>
              ) : (
                <span>Regenerate 🔄</span>
              )}
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

        {/* Study Mode Toggles & Progress Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterDueOnly(false)
                setCurrentIndex(0)
                setShowAnswer(false)
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                !filterDueOnly
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              All Cards ({cards.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setFilterDueOnly(true)
                setCurrentIndex(0)
                setShowAnswer(false)
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-2xs ${
                filterDueOnly
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Due for Review ({dueCards.length})
            </button>
          </div>

          {activeCards.length > 0 && (
            <span className="font-mono text-xs font-bold text-slate-500">
              Card {currentIndex + 1} of {activeCards.length}
            </span>
          )}
        </div>

        {/* Progress Line */}
        {activeCards.length > 0 && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300 rounded-full"
              style={{
                width: `${Math.round(((currentIndex + 1) / activeCards.length) * 100)}%`,
              }}
            />
          </div>
        )}

        {/* MAIN FLASHCARD DECK DISPLAY */}
        {activeCards.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <EmptyState
              icon="🎉"
              title="No cards due for review!"
              description="You have completed all scheduled flashcards for this material. Switch to 'All Cards' to practice any time."
            />
          </div>
        ) : currentCard ? (
          <div className="space-y-4">
            {/* Interactive Card Body */}
            <div
              onClick={() => setShowAnswer(!showAnswer)}
              className="group relative min-h-[320px] sm:min-h-[360px] cursor-pointer rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-md transition-all hover:border-slate-300 hover:shadow-lg flex flex-col justify-between"
            >
              {/* Card Top Meta */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  🏷️ {currentCard.topic_name || "General"}
                </span>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      currentCard.difficulty === "easy"
                        ? "bg-emerald-50 text-emerald-700"
                        : currentCard.difficulty === "hard"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {currentCard.difficulty || "medium"}
                  </span>

                  {currentCard.review_count > 0 && (
                    <span className="font-mono text-[10px] text-slate-400">
                      {currentCard.review_count} {currentCard.review_count === 1 ? "review" : "reviews"}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Content (Front / Back) */}
              <div className="py-6 my-auto text-center">
                {!showAnswer ? (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3 block">
                      QUESTION
                    </span>
                    <p className="text-base sm:text-xl font-bold text-slate-900 leading-snug">
                      {currentCard.question}
                    </p>
                    <p className="mt-6 text-xs font-semibold text-blue-600 group-hover:underline">
                      Click to Reveal Answer (Space) 👁️
                    </p>
                  </div>
                ) : (
                  <div className="text-left space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                        QUESTION
                      </span>
                      <p className="text-xs sm:text-sm font-semibold text-slate-600">
                        {currentCard.question}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1 block">
                        ANSWER
                      </span>
                      <p className="text-xs sm:text-base font-bold text-slate-900 leading-relaxed whitespace-pre-wrap">
                        {currentCard.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Bottom / Source Citation */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                <span className="truncate max-w-xs">
                  📄 Source: {material?.title}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenReader && onOpenReader(materialId)
                  }}
                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View in Reader ↗
                </button>
              </div>
            </div>

            {/* SPACED REPETITION SELF-ASSESSMENT BUTTONS (When Answer is Revealed) */}
            {showAnswer && (
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-3">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                  How well did you know this?
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleRating("again")}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-rose-800 hover:bg-rose-100 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="text-xs font-bold">🔄 Again (1)</span>
                    <span className="text-[10px] text-rose-600">&lt; 10 mins</span>
                  </button>

                  <button
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleRating("hard")}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-amber-800 hover:bg-amber-100 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="text-xs font-bold">⚡ Hard (2)</span>
                    <span className="text-[10px] text-amber-600">1 day</span>
                  </button>

                  <button
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleRating("good")}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3 text-blue-800 hover:bg-blue-100 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="text-xs font-bold">👍 Good (3)</span>
                    <span className="text-[10px] text-blue-600">3 days</span>
                  </button>

                  <button
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleRating("easy")}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-800 hover:bg-emerald-100 transition shadow-2xs active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="text-xs font-bold">⭐ Easy (4)</span>
                    <span className="text-[10px] text-emerald-600">7 days</span>
                  </button>
                </div>
              </div>
            )}

            {/* PREVIOUS / NEXT NAVIGATION BAR */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => {
                  setCurrentIndex((prev) => Math.max(0, prev - 1))
                  setShowAnswer(false)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-40"
              >
                ← Previous
              </button>

              <span className="text-[11px] text-slate-400 font-medium">
                Tip: Press Space to flip • Left/Right arrows to navigate
              </span>

              <button
                type="button"
                disabled={currentIndex + 1 >= activeCards.length}
                onClick={() => {
                  setCurrentIndex((prev) => Math.min(activeCards.length - 1, prev + 1))
                  setShowAnswer(false)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default Flashcards
