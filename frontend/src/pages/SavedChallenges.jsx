import { useState, useMemo, useEffect } from "react"
import { FEED_CATALOG } from "../data/feedCatalog"
import { toggleSavedItem, getUserSavedItems } from "../utils/socialInteractions"

const CATEGORIES = ["All", "Challenges", "Learn", "Tech", "Community"]

export default function SavedChallenges({
  user,
  savedItemIds = new Set(),
  completedKeys = new Set(),
  onSavedUpdated,
  onOpenChallenge,
  onNavigate,
}) {
  const [activeCategory, setActiveCategory] = useState("All")
  const [localSavedIds, setLocalSavedIds] = useState(() => savedItemIds || new Set())

  // Keep localSavedIds in sync when parent prop changes
  useEffect(() => {
    if (savedItemIds) {
      setLocalSavedIds(savedItemIds)
    }
  }, [savedItemIds])

  // Eager fallback load from authoritative user storage if prop is empty on direct navigation
  useEffect(() => {
    if (!user?.id) return
    let isMounted = true
    getUserSavedItems(user.id).then((items) => {
      if (isMounted && items) {
        setLocalSavedIds(items)
      }
    })
    return () => {
      isMounted = false
    }
  }, [user?.id])

  const savedItems = useMemo(() => {
    return FEED_CATALOG.filter((item) => localSavedIds.has(item.id))
  }, [localSavedIds])

  const filteredItems = useMemo(() => {
    if (activeCategory === "All") return savedItems
    return savedItems.filter((item) => {
      if (activeCategory === "Challenges") return item.category === "Challenges" || item.type.includes("challenge")
      if (activeCategory === "Learn") return item.category === "Learn" || item.type.includes("concept")
      if (activeCategory === "Tech") return item.category === "Tech" || item.type.includes("tech")
      if (activeCategory === "Community") return item.category === "Community" || item.type.includes("project")
      return true
    })
  }, [savedItems, activeCategory])

  async function handleRemoveSave(itemId) {
    if (!user?.id) return
    // Immediate UI feedback
    setLocalSavedIds((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
    await toggleSavedItem(user.id, itemId)
    if (onSavedUpdated) onSavedUpdated(itemId, false)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
            PERSONAL LEARNING LIBRARY
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
            Saved Challenges & Concepts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#52525B] dark:text-[#a1a1aa]">
            {savedItems.length} bookmarked {savedItems.length === 1 ? "item" : "items"} available for offline study and revision.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("Home")}
            className="self-start sm:self-center flex items-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-white px-4 py-2 text-xs font-bold text-[#18181B] hover:bg-[#F7F7F2] transition dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5] dark:hover:bg-[#182226] shadow-2xs"
          >
            <span>← Back to Home</span>
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 border-b border-[#E4E4E7] pb-4 dark:border-[#27343a]">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] ${
              activeCategory === cat
                ? "bg-[#18181B] text-white shadow-2xs dark:bg-[#2DD4BF] dark:text-[#0f1416]"
                : "border border-[#E4E4E7] bg-white text-[#52525B] hover:bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#a1a1aa]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Saved Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#E4E4E7] p-12 text-center dark:border-[#27343a]">
          <span className="text-4xl">🔖</span>
          <h3 className="mt-3 text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
            No saved items in this category
          </h3>
          <p className="mt-1 text-xs text-[#52525B] max-w-sm mx-auto dark:text-[#a1a1aa]">
            Click the bookmark icon 🔖 on any challenge or concept in your Home feed to save it here for later.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredItems.map((item) => {
            const isSolved =
              completedKeys.has(`challenge_completion:${item.id}`) ||
              completedKeys.has(item.id)

            return (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-3xl border border-[#E4E4E7] bg-white p-5 shadow-2xs transition hover:border-[#0F766E]/40 dark:border-[#27343a] dark:bg-[#141c1f]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0F766E] border border-teal-200/60 dark:bg-[#182226] dark:border-[#2DD4BF]/30 dark:text-[#2DD4BF]">
                      {item.subject}
                    </span>
                    {isSolved && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-[#15803D] border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300">
                        ✓ Solved
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 text-sm font-bold text-[#18181B] dark:text-[#f4f4f5] line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs text-[#52525B] dark:text-[#a1a1aa] line-clamp-2">
                    {item.content}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#E4E4E7] pt-3 dark:border-[#27343a]">
                  <span className="text-xs font-black text-[#0F766E] dark:text-[#2DD4BF]">
                    ⭐ +{item.xp_reward} XP
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSave(item.id)}
                      className="rounded-xl border border-[#E4E4E7] px-3 py-1.5 text-xs font-semibold text-[#71717A] hover:bg-[#F7F7F2] hover:text-[#DC2626] transition dark:border-[#27343a] dark:text-[#a1a1aa] dark:hover:bg-[#182226]"
                    >
                      Remove
                    </button>
                    {onOpenChallenge && (
                      <button
                        type="button"
                        onClick={() => onOpenChallenge(item)}
                        className="rounded-xl bg-[#0F766E] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#115E59] transition active:scale-[0.98]"
                      >
                        {isSolved ? "Review" : "Solve"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
