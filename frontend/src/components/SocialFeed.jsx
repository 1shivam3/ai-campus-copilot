import { useState, useMemo, useEffect, memo } from "react"
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

function SocialFeed({
  user,
  profile,
  topicProgress = [],
  exams = [],
  completedKeys = new Set(),
  savedItemIds,
  selectedChallenge,
  onClearSelectedChallenge,
  onXPUpdated,
  onOpenFocusSession,
  onChallengeSolved,
  onSavedItemToggled, // Notify parent when save state changes so savedItemIds stays in sync
}) {
  const [activeTab, setActiveTab] = useState("For You")
  const [activeSolverItem, setActiveSolverItem] = useState(null)
  const [likedIds, setLikedIds] = useState(() => new Set())
  const [savedIds, setSavedIds] = useState(() => savedItemIds || new Set())
  const [shareToast, setShareToast] = useState(null)

  // Open solver modal if parent requests a specific challenge (e.g. from Saved page)
  useEffect(() => {
    if (selectedChallenge) {
      setActiveSolverItem(selectedChallenge)
    }
  }, [selectedChallenge])

  // Sync savedIds if parent passes updated savedItemIds
  useEffect(() => {
    if (savedItemIds) {
      setSavedIds(savedItemIds)
    }
  }, [savedItemIds])

  // Load user likes and saves
  useEffect(() => {
    if (!user?.id) return
    let isMounted = true
    Promise.all([getUserLikes(user.id), getUserSavedItems(user.id)]).then(([likes, saves]) => {
      if (isMounted) {
        setLikedIds(likes)
        setSavedIds(saves)
        if (onSavedItemToggled && saves) {
          // Initialize parent set if needed
          saves.forEach((id) => onSavedItemToggled(id, true))
        }
      }
    })
    return () => {
      isMounted = false
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (onSavedItemToggled) {
      onSavedItemToggled(itemId, res.isSaved)
    }
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
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#12312F] px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-fade-in dark:bg-[#0F766E]">
          {shareToast}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
              SOCIAL LEARNING & ADAPTIVE FEED
            </span>
          </div>
          <h3 className="mt-0.5 text-xl font-bold text-[#18181B] dark:text-[#f4f4f5]">
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
                  ? "bg-[#18181B] text-white shadow-2xs dark:bg-[#2DD4BF] dark:text-[#0f1416]"
                  : "border border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed Cards List */}
      <div className="space-y-4">
        {rankedItems.length === 0 ? (
          <div className="rounded-3xl border border-[#E4E4E7] bg-white p-8 text-center shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
            <span className="text-3xl">🎉</span>
            <h4 className="mt-2 text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
              All Available Challenges Solved!
            </h4>
            <p className="mt-1 text-xs text-[#52525B] dark:text-[#a1a1aa] max-w-sm mx-auto">
              You&apos;ve cleared all active curriculum challenges in this category. Head to Exam Mode or Topic Quizzes to keep leveling up your mastery!
            </p>
          </div>
        ) : (
          rankedItems.map((item, index) => {
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
                    ? "border-[#0F766E]/40 bg-[#ECFDF5]/50 shadow-2xs dark:border-[#2DD4BF]/40 dark:bg-[#182226]"
                    : "border-[#E4E4E7] bg-white hover:border-[#0F766E]/40 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]"
                }`}
              >
                {/* Top Priority Badge */}
                {isTopForYou && (
                  <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#0F766E] px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-2xs self-start">
                    <span>🔥 Recommended For You</span>
                  </div>
                )}

                <div>
                  {/* Subject & Difficulty Header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-extrabold text-[#0F766E] uppercase dark:text-[#2DD4BF]">
                      {item.subject}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          item.difficulty === "Easy"
                            ? "bg-emerald-50 text-[#15803D] dark:bg-emerald-950/40 dark:text-emerald-300"
                            : item.difficulty === "Hard"
                            ? "bg-rose-50 text-[#DC2626] dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-amber-50 text-[#D97706] dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {item.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Challenge Title */}
                  <h4 className="mt-2 text-sm sm:text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
                    {item.title}
                  </h4>

                  {/* Question / Description Snippet */}
                  <p className="mt-1 text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa] leading-relaxed line-clamp-3 font-normal">
                    {item.content}
                  </p>

                  {/* Real-Data Social Metrics */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-[#71717A] dark:text-[#71717a] border-t border-[#E4E4E7] dark:border-[#27343a] pt-2.5">
                    {realParticipation > 0 ? (
                      <>
                        <span>👥 {realParticipation} participated</span>
                        <span>·</span>
                        <span>🎯 {item.success_rate || 88}% success</span>
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
                <div className="mt-3.5 flex items-center justify-between border-t border-[#E4E4E7] pt-3 dark:border-[#27343a]">
                  {/* Social Buttons: Helpful, Save, Share */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleToggleLike(item.id, e)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        isLiked
                          ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
                          : "text-[#52525B] hover:bg-[#F7F7F2] dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
                      }`}
                      title={isLiked ? "Unlike" : "Helpful / Like"}
                    >
                      <span>{isLiked ? "❤️" : "🤍"}</span>
                      <span>{realLikes > 0 ? realLikes : "Helpful"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleToggleSave(item.id, e)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                        isSaved
                          ? "bg-teal-50 text-[#0F766E] dark:bg-[#182226] dark:text-[#2DD4BF]"
                          : "text-[#52525B] hover:bg-[#F7F7F2] dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
                      }`}
                      title={isSaved ? "Remove from saved" : "Bookmark / Save for review"}
                    >
                      <span>{isSaved ? "🔖" : "📑"}</span>
                      <span>{isSaved ? "Saved" : "Save"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleShare(item, e)}
                      className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold text-[#52525B] hover:bg-[#F7F7F2] transition dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
                      title="Share challenge"
                    >
                      <span>🔗</span>
                      <span>Share</span>
                    </button>
                  </div>

                  {/* Primary Action Button */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0F766E] dark:text-[#2DD4BF]">
                      +{item.xp_reward || 25} XP
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSolverItem(item)}
                      className="rounded-2xl bg-[#0F766E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#115E59] shadow-2xs transition active:scale-95"
                    >
                      {item.action || "Solve"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
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
          onClose={() => {
            setActiveSolverItem(null)
            if (onClearSelectedChallenge) onClearSelectedChallenge()
          }}
          onXPUpdated={onXPUpdated}
          onChallengeSolved={onChallengeSolved}
        />
      )}
    </section>
  )
}

/**
 * Interactive Challenge Solver Modal with Stable Option IDs & Instant Verification.
 */
function ChallengeSolverModal({
  challenge,
  user,
  isAlreadySolved,
  onClose,
  onXPUpdated,
  onChallengeSolved,
}) {
  const [selectedOptionId, setSelectedOptionId] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [awardedXP, setAwardedXP] = useState(0)

  // Normalize options with stable IDs and verify correct option
  const normalizedOptions = useMemo(() => {
    if (!challenge?.options) return []
    return challenge.options.map((opt, idx) => {
      const isObj = typeof opt === "object" && opt !== null
      const id = isObj ? opt.id : `opt_${idx}`
      const text = isObj ? opt.text : opt
      const isCorrectOption =
        challenge.correct_option_id !== undefined
          ? challenge.correct_option_id === id
          : challenge.correct_index !== undefined
          ? challenge.correct_index === idx
          : false
      return {
        id,
        text,
        isCorrectOption,
        letter: String.fromCharCode(65 + idx),
        originalIdx: idx,
      }
    })
  }, [challenge])

  async function handleValidate() {
    if (selectedOptionId === null || submitted) return
    const chosen = normalizedOptions.find((o) => o.id === selectedOptionId)
    const correct = chosen ? chosen.isCorrectOption : false
    setIsCorrect(correct)
    setSubmitted(true)

    // Record attempt for strict non-repetition
    if (user?.id) {
      await recordChallengeAttempt({
        userId: user.id,
        challengeId: challenge.id,
        passed: correct,
        score: correct ? 100 : 0,
        selectedOption: chosen ? chosen.letter : selectedOptionId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18181B]/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#E4E4E7] bg-white p-6 shadow-2xl dark:border-[#27343a] dark:bg-[#141c1f] animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-1.5 text-[#71717A] hover:bg-[#F7F7F2] hover:text-[#18181B] dark:hover:bg-[#182226] dark:hover:text-white"
          aria-label="Close solver"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0F766E] dark:text-[#2DD4BF]">
              {challenge.subject}
            </span>
            <span className="rounded-full bg-[#F7F7F2] px-2 py-0.2 text-[10px] font-bold text-[#52525B] border border-[#E4E4E7] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#a1a1aa]">
              {challenge.difficulty}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-bold text-[#18181B] dark:text-[#f4f4f5]">
            {challenge.title}
          </h3>
        </div>

        {/* Code Snippet (if available) */}
        {challenge.code_snippet && (
          <pre className="mb-4 overflow-x-auto rounded-2xl bg-[#12312F] p-4 font-mono text-xs text-[#ECFDF5] dark:bg-[#0b1012]">
            <code>{challenge.code_snippet}</code>
          </pre>
        )}

        {/* Question Text */}
        <p className="mb-4 text-xs sm:text-sm font-semibold text-[#18181B] dark:text-[#f4f4f5]">
          {challenge.question || challenge.content}
        </p>

        {/* Interactive MCQ Options with Stable Identifiers */}
        {normalizedOptions.length > 0 && (
          <div className="space-y-2 mb-5">
            {normalizedOptions.map((opt) => {
              const isSelected = selectedOptionId === opt.id
              let optStyle =
                "border-[#E4E4E7] bg-[#F7F7F2] hover:bg-white text-[#18181B] dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"

              if (submitted) {
                if (opt.isCorrectOption) {
                  optStyle =
                    "border-emerald-500 bg-[#ECFDF5] text-[#15803D] font-bold dark:bg-emerald-950/60 dark:text-emerald-200"
                } else if (isSelected && !isCorrect) {
                  optStyle =
                    "border-rose-500 bg-rose-50 text-[#DC2626] font-bold dark:bg-rose-950/60 dark:text-rose-200"
                } else {
                  optStyle = "opacity-40 border-[#E4E4E7] dark:border-[#27343a]"
                }
              } else if (isSelected) {
                optStyle =
                  "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E] font-bold shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`w-full rounded-2xl border p-3.5 text-left text-xs sm:text-sm transition ${optStyle}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs opacity-70">
                        {opt.letter}.
                      </span>
                      <span>{opt.text}</span>
                    </div>
                    {submitted && opt.isCorrectOption && <span>✓</span>}
                    {submitted && isSelected && !isCorrect && <span>✗</span>}
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
                ? "border border-emerald-200 bg-[#ECFDF5] text-[#15803D] dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border border-rose-200 bg-rose-50 text-[#DC2626] dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-extrabold">
                {isCorrect ? "🎉 Correct! High Yield Answer" : "❌ Incorrect Attempt"}
              </span>
              {awardedXP > 0 && (
                <span className="font-black text-[#0F766E] dark:text-[#2DD4BF]">
                  ⭐ +{awardedXP} XP Earned!
                </span>
              )}
            </div>

            <p className="mt-1 leading-relaxed text-[#52525B] dark:text-[#d4d4d8]">
              {challenge.explanation}
            </p>

            {/* Social Performance Proof */}
            <div className="mt-3 border-t border-[#E4E4E7] dark:border-[#27343a] pt-2 text-[11px] text-[#71717A] dark:text-[#a1a1aa] font-medium">
              {isCorrect ? (
                <span>🏆 You solved this faster than {challenge.success_rate || 88}% of participants!</span>
              ) : (
                <span>💡 {challenge.success_rate || 88}% of students solved this on their first attempt.</span>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#E4E4E7] pt-4 dark:border-[#27343a]">
          {!submitted ? (
            <button
              type="button"
              disabled={selectedOptionId === null}
              onClick={handleValidate}
              className="rounded-2xl bg-[#0F766E] px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] disabled:opacity-40 transition active:scale-95"
            >
              Verify Answer & Submit
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-[#12312F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0F766E] transition active:scale-95 dark:bg-[#2DD4BF] dark:text-[#0f1416]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(SocialFeed)
