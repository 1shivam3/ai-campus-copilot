import { useState, useMemo, useEffect } from "react"
import { FEED_CATALOG } from "../data/feedCatalog"
import { rankFeedItems } from "../utils/feedRanking"
import { awardXP } from "../utils/xpEngine"
import {
  getUserLikes,
  toggleFeedItemLike,
  getUserSavedItems,
  toggleSavedItem,
  shareChallenge,
} from "../utils/socialInteractions"
import { recordChallengeAttempt } from "../utils/dailyChallengeEngine"

const FEED_TABS = [
  { id: "For You", label: "For You", icon: "✨" },
  { id: "Challenges", label: "Challenges", icon: "⚡" },
  { id: "Learn", label: "Learn", icon: "📚" },
  { id: "Tech", label: "Tech Radar", icon: "🌍" },
  { id: "Community", label: "Community", icon: "👥" },
]

export default function SocialFeed({
  user,
  profile,
  topicProgress = [],
  exams = [],
  completedKeys = new Set(),
  onXPUpdated,
  onOpenFocusSession,
  onChallengeSolved,
}) {
  const [activeTab, setActiveTab] = useState("For You")
  const [activeSolverItem, setActiveSolverItem] = useState(null)
  const [likedIds, setLikedIds] = useState(() => new Set())
  const [savedIds, setSavedIds] = useState(() => new Set())
  const [shareToast, setShareToast] = useState(null)

  // Load user likes and saves
  useEffect(() => {
    if (!user?.id) return
    let isMounted = true
    Promise.all([getUserLikes(user.id), getUserSavedItems(user.id)]).then(([likes, saves]) => {
      if (isMounted) {
        setLikedIds(likes)
        setSavedIds(saves)
      }
    })
    return () => {
      isMounted = false
    }
  }, [user?.id])

  // Ranked feed items
  const rankedItems = useMemo(() => {
    return rankFeedItems({
      feedItems: FEED_CATALOG,
      profile,
      topicProgress,
      exams,
      completedReferenceKeys: completedKeys,
      likedItemIds: likedIds,
      activeTab,
    })
  }, [profile, topicProgress, exams, completedKeys, likedIds, activeTab])

  // Social interactions
  async function handleToggleLike(itemId, e) {
    e?.stopPropagation()
    if (!user?.id) return
    const res = await toggleFeedItemLike(user.id, itemId)
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (res.isLiked) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function handleToggleSave(itemId, e) {
    e?.stopPropagation()
    if (!user?.id) return
    const res = await toggleSavedItem(user.id, itemId)
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (res.isSaved) next.add(itemId)
      else next.delete(itemId)
      return next
    })
  }

  async function handleShare(item, e) {
    e?.stopPropagation()
    const res = await shareChallenge(item)
    if (res.success) {
      setShareToast("Link copied to clipboard!")
      setTimeout(() => setShareToast(null), 2500)
    }
  }

  return (
    <section className="mb-8 space-y-5">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl dark:bg-blue-600 animate-fade-in">
          {shareToast}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              SOCIAL LEARNING & ADAPTIVE FEED
            </span>
          </div>
          <h3 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
            Curated Academic Challenges
          </h3>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto pb-1 scrollbar-none gap-1.5">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                  : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed Cards List (Single Column Feed, Max Responsive Readability) */}
      <div className="space-y-4">
        {rankedItems.map((item, index) => {
          const isSolved =
            completedKeys.has(`challenge_completion:${item.id}`) ||
            completedKeys.has(item.id)
          const isLiked = likedIds.has(item.id)
          const isSaved = savedIds.has(item.id)
          const isTopForYou = activeTab === "For You" && index === 0 && !isSolved
          const realLikes = (item.likes_count || 0) + (isLiked ? 1 : 0)
          const realParticipation = item.participation_count || 0

          return (
            <div
              key={item.id}
              className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-4 sm:p-5 transition-all ${
                isTopForYou
                  ? "border-blue-500/80 bg-linear-to-br from-blue-50/60 via-white to-indigo-50/30 shadow-sm ring-1 ring-blue-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30 dark:border-blue-500/40"
                  : isSolved
                  ? "border-slate-200/60 bg-slate-50/70 dark:border-slate-800/60 dark:bg-slate-900/40 opacity-85"
                  : "border-slate-200/80 bg-white hover:border-slate-300 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              {/* Top Priority Badge */}
              {isTopForYou && (
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs self-start">
                  <span>🔥 Recommended For You</span>
                </div>
              )}

              <div>
                {/* Subject & Difficulty Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-extrabold text-blue-600 uppercase dark:text-blue-400">
                    {item.subject}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        item.difficulty === "Easy"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : item.difficulty === "Hard"
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {item.difficulty}
                    </span>
                    {isSolved && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        ✓ Solved
                      </span>
                    )}
                  </div>
                </div>

                {/* Challenge Title */}
                <h4 className="mt-2 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h4>

                {/* Question / Description Snippet */}
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                  {item.content}
                </p>

                {/* Real-Data Social Metrics */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                  {realParticipation > 0 ? (
                    <>
                      <span>👥 {realParticipation} participated</span>
                      <span>·</span>
                      <span>🎯 {item.success_rate}% success</span>
                    </>
                  ) : (
                    <span>🎯 Be the first to solve!</span>
                  )}
                  {item.source && (
                    <>
                      <span>·</span>
                      <span className="truncate">{item.source}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                {/* Social Buttons: Helpful, Save, Share */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleToggleLike(item.id, e)}
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      isLiked
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                    title="Helpful"
                  >
                    <span>{isLiked ? "❤️" : "🤍"}</span>
                    <span>{realLikes > 0 ? realLikes : "Helpful"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleToggleSave(item.id, e)}
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      isSaved
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                    title={isSaved ? "Saved" : "Save challenge"}
                  >
                    <span>{isSaved ? "🔖" : "🏷️"}</span>
                    <span>{isSaved ? "Saved" : "Save"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleShare(item, e)}
                    className="flex items-center gap-1 rounded-xl px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition"
                    title="Share challenge"
                  >
                    <span>↗️</span>
                    <span className="hidden sm:inline">Share</span>
                  </button>
                </div>

                {/* Primary Action Button */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    ⭐ +{item.xp_reward} XP
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSolverItem(item)}
                    className={`rounded-2xl px-4 py-1.5 text-xs font-bold transition active:scale-95 ${
                      isSolved
                        ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        : "bg-slate-900 text-white hover:bg-slate-800 shadow-2xs dark:bg-blue-600 dark:hover:bg-blue-700"
                    }`}
                  >
                    {isSolved ? "Review" : item.action || "Solve"}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Interactive Challenge Solver Modal */}
      {activeSolverItem && (
        <ChallengeSolverModal
          challenge={activeSolverItem}
          user={user}
          isAlreadySolved={
            completedKeys.has(`challenge_completion:${activeSolverItem.id}`) ||
            completedKeys.has(activeSolverItem.id)
          }
          onClose={() => setActiveSolverItem(null)}
          onXPUpdated={onXPUpdated}
          onChallengeSolved={onChallengeSolved}
        />
      )}
    </section>
  )
}

/**
 * Interactive Challenge Solver Modal with Instant Validation & Social Percentile Comparison.
 */
function ChallengeSolverModal({
  challenge,
  user,
  isAlreadySolved,
  onClose,
  onXPUpdated,
  onChallengeSolved,
}) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [awardedXP, setAwardedXP] = useState(0)

  async function handleValidate() {
    if (selectedIdx === null || submitted) return
    const correct = selectedIdx === challenge.correct_index
    setIsCorrect(correct)
    setSubmitted(true)

    // Record attempt for strict non-repetition
    if (user?.id) {
      await recordChallengeAttempt({
        userId: user.id,
        challengeId: challenge.id,
        passed: correct,
        score: correct ? 100 : 0,
        selectedOption: selectedIdx,
      })
    }

    if (correct && user?.id) {
      const res = await awardXP({
        userId: user.id,
        amount: challenge.xp_reward || 25,
        reason: `Solved Universal Challenge: ${challenge.title}`,
        referenceType: "challenge",
        referenceId: challenge.id,
      })
      if (!res.alreadyAwarded) {
        setAwardedXP(res.amount)
        if (onXPUpdated) onXPUpdated()
      }
      if (onChallengeSolved) onChallengeSolved(challenge.id)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Close solver"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              {challenge.subject}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {challenge.difficulty}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {challenge.title}
          </h3>
        </div>

        {/* Code Snippet (if available) */}
        {challenge.code_snippet && (
          <pre className="mb-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 font-mono text-xs text-slate-200 dark:bg-black/80">
            <code>{challenge.code_snippet}</code>
          </pre>
        )}

        {/* Question Text */}
        <p className="mb-4 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
          {challenge.question || challenge.content}
        </p>

        {/* Interactive MCQ Options */}
        {challenge.options && (
          <div className="space-y-2 mb-5">
            {challenge.options.map((opt, idx) => {
              let optStyle =
                "border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200"

              if (submitted) {
                if (idx === challenge.correct_index) {
                  optStyle =
                    "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold dark:bg-emerald-950/60 dark:text-emerald-200"
                } else if (idx === selectedIdx && !isCorrect) {
                  optStyle =
                    "border-rose-500 bg-rose-50 text-rose-900 font-bold dark:bg-rose-950/60 dark:text-rose-200"
                } else {
                  optStyle = "opacity-40 border-slate-200 dark:border-slate-800"
                }
              } else if (selectedIdx === idx) {
                optStyle =
                  "border-blue-600 bg-blue-50 text-blue-900 font-bold dark:bg-blue-950/60 dark:text-blue-200 shadow-2xs"
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full rounded-2xl border p-3.5 text-left text-xs sm:text-sm transition ${optStyle}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    {submitted && idx === challenge.correct_index && <span>✓</span>}
                    {submitted && idx === selectedIdx && !isCorrect && <span>✗</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Post-Submit Result & Community Comparison */}
        {submitted && (
          <div
            className={`mb-5 rounded-2xl p-4 text-xs ${
              isCorrect
                ? "border border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold">
                {isCorrect ? "🎉 Correct! High Yield Answer" : "❌ Incorrect Attempt"}
              </span>
              {awardedXP > 0 && (
                <span className="font-black text-emerald-700 dark:text-emerald-300">
                  ⭐ +{awardedXP} XP Earned!
                </span>
              )}
            </div>

            <p className="mt-1 leading-relaxed text-slate-700 dark:text-slate-300">
              {challenge.explanation}
            </p>

            {/* Social Performance Proof */}
            <div className="mt-3 border-t border-black/10 pt-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {isCorrect ? (
                <span>🏆 You solved this faster than {challenge.success_rate}% of participants!</span>
              ) : (
                <span>💡 {challenge.success_rate}% of students solved this on their first attempt.</span>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          {!submitted ? (
            <button
              type="button"
              disabled={selectedIdx === null}
              onClick={handleValidate}
              className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-40 transition active:scale-95"
            >
              Verify Answer & Submit
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition active:scale-95 dark:bg-blue-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
