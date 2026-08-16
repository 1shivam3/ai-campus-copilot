import { useState, useMemo } from "react"
import { FEED_CATALOG } from "../data/feedCatalog"
import { rankFeedItems } from "../utils/feedRanking"
import { awardXP, XP_REWARDS } from "../utils/xpEngine"

const FEED_TABS = [
  { id: "For You", label: "For You", icon: "✨" },
  { id: "Challenges", label: "Challenges", icon: "🔥" },
  { id: "Learn", label: "Learn", icon: "🧠" },
  { id: "Tech", label: "Tech Radar", icon: "🌍" },
  { id: "Community", label: "Community", icon: "🏆" },
]

export default function SocialFeed({
  user,
  profile,
  topicProgress = [],
  exams = [],
  completedKeys = new Set(),
  onXPUpdated,
  onOpenFocusSession,
}) {
  const [activeTab, setActiveTab] = useState("For You")
  const [activeChallenge, setActiveChallenge] = useState(null) // item currently in solver modal
  const [selectedOption, setSelectedOption] = useState(null)
  const [submissionResult, setSubmissionResult] = useState(null) // { isCorrect, xpAwarded, explanation }
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Deterministically ranked feed items
  const rankedItems = useMemo(() => {
    return rankFeedItems({
      feedItems: FEED_CATALOG,
      profile,
      topicProgress,
      exams,
      completedReferenceKeys: completedKeys,
      activeTab,
    })
  }, [profile, topicProgress, exams, completedKeys, activeTab])

  // Top highlight "One Thing For You"
  const topHighlight = activeTab === "For You" && rankedItems.length > 0 ? rankedItems[0] : null
  const regularItems = activeTab === "For You" ? rankedItems.slice(1) : rankedItems

  // Open Challenge Modal
  function handleOpenChallenge(item) {
    setActiveChallenge(item)
    setSelectedOption(null)
    setSubmissionResult(null)
  }

  // Handle Challenge Submission & XP Award
  async function handleSubmitAnswer(e) {
    e?.preventDefault()
    if (!activeChallenge || selectedOption === null || !user?.id) return

    setIsSubmitting(true)
    const isCorrect = selectedOption === activeChallenge.correct_index
    const xpAmount = activeChallenge.xp_reward || XP_REWARDS.QUICK_CHALLENGE

    if (isCorrect) {
      const awardResult = await awardXP({
        userId: user.id,
        amount: xpAmount,
        reason: `Solved: ${activeChallenge.title}`,
        referenceType: activeChallenge.type || "challenge",
        referenceId: activeChallenge.id,
      })

      setSubmissionResult({
        isCorrect: true,
        xpAwarded: awardResult.alreadyAwarded ? 0 : xpAmount,
        alreadyAwarded: awardResult.alreadyAwarded,
        explanation: activeChallenge.explanation,
      })

      if (onXPUpdated) {
        onXPUpdated()
      }
    } else {
      setSubmissionResult({
        isCorrect: false,
        xpAwarded: 0,
        explanation: activeChallenge.explanation,
      })
    }

    setIsSubmitting(false)
  }

  return (
    <section className="mb-8">
      {/* Section Title & Tagline */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              SOCIAL LEARNING HUB
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
            For You · High-Yield Feed
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Curated daily challenges, syllabus breakdowns, and verified tech radar tailored to your cohort.
          </p>
        </div>
      </div>

      {/* Feed Tabs Navigation */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FEED_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.98] shrink-0 ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Top Highlight Card: "One Thing For You" */}
      {topHighlight && (
        <div className="mb-6 overflow-hidden rounded-3xl border border-blue-200/80 bg-linear-to-br from-blue-500/10 via-indigo-500/5 to-transparent p-5 sm:p-7 shadow-xs dark:border-blue-900/60 dark:bg-slate-900/90 relative">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs">
                  🔥 TOP PRIORITY FOR YOU
                </span>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {topHighlight.subject}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {topHighlight.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {topHighlight.content}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                  ⭐ +{topHighlight.xp_reward} XP
                </span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
                  🏷️ {topHighlight.topic}
                </span>
                {topHighlight.isCompleted && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                    ✓ Completed
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChallenge(topHighlight)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition active:scale-[0.98] shrink-0"
            >
              <span>{topHighlight.isCompleted ? "Review Solution →" : `${topHighlight.action || "Start Challenge"} →`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Feed Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {regularItems.map((item) => {
          const isCompleted = item.isCompleted

          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between rounded-3xl border p-5 sm:p-6 transition-all duration-150 ${
                isCompleted
                  ? "border-slate-200/60 bg-slate-50/40 opacity-80 dark:border-slate-800/60 dark:bg-slate-900/50"
                  : "border-slate-200/80 bg-white hover:border-slate-300 shadow-xs dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {item.subject}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                      ⭐ +{item.xp_reward} XP
                    </span>
                    {isCompleted && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ Solved
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-2">
                  {item.title}
                </h3>

                {/* Content snippet */}
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {item.content}
                </p>

                {/* Code Preview if present */}
                {item.code_snippet && (
                  <div className="mt-3 overflow-hidden rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300">
                    <pre className="overflow-x-auto whitespace-pre no-scrollbar">
                      {item.code_snippet.split("\n").slice(0, 3).join("\n")}
                      {item.code_snippet.split("\n").length > 3 && "\n..."}
                    </pre>
                  </div>
                )}
              </div>

              {/* Bottom Action Row */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {item.source}
                </span>

                <button
                  type="button"
                  onClick={() => handleOpenChallenge(item)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-[0.98] ${
                    isCompleted
                      ? "border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700"
                  }`}
                >
                  <span>{isCompleted ? "View Solution" : item.action || "Solve"}</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE CHALLENGE / CONCEPT SOLVER MODAL */}
      {/* ========================================================================= */}
      {activeChallenge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {activeChallenge.subject} · {activeChallenge.difficulty}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activeChallenge.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveChallenge(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Content Explanation */}
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {activeChallenge.content}
              </p>

              {/* Code Snippet */}
              {activeChallenge.code_snippet && (
                <div className="rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto shadow-inner">
                  <pre>{activeChallenge.code_snippet}</pre>
                </div>
              )}

              {/* Markdown Brief if concept drop */}
              {activeChallenge.brief_markdown && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs sm:text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {activeChallenge.brief_markdown}
                </div>
              )}

              {/* Question */}
              {activeChallenge.question && (
                <div className="pt-2">
                  <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-3">
                    {activeChallenge.question}
                  </p>

                  {/* Options List */}
                  <div className="space-y-2.5">
                    {activeChallenge.options?.map((opt, idx) => {
                      const isSelected = selectedOption === idx
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={submissionResult !== null && submissionResult.isCorrect}
                          onClick={() => setSelectedOption(idx)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-200"
                              : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <span className="text-blue-600 font-bold">●</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Submission Result & Explanation */}
              {submissionResult && (
                <div
                  className={`mt-4 rounded-2xl p-4 border text-xs sm:text-sm ${
                    submissionResult.isCorrect
                      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <span>{submissionResult.isCorrect ? "🎉 Correct Answer!" : "❌ Incorrect, try again"}</span>
                    {submissionResult.isCorrect && submissionResult.xpAwarded > 0 && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">
                        +{submissionResult.xpAwarded} XP Awarded
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs opacity-90 leading-relaxed">
                    {submissionResult.explanation}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Reward: ⭐ +{activeChallenge.xp_reward} XP
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveChallenge(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Close
                </button>

                {(!submissionResult || !submissionResult.isCorrect) && (
                  <button
                    type="button"
                    disabled={selectedOption === null || isSubmitting}
                    onClick={handleSubmitAnswer}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? "Checking..." : "Submit Answer"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
