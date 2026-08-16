import { useState, useMemo } from "react"
import { FEED_CATALOG } from "../data/feedCatalog"
import { toggleSavedItem } from "../utils/socialInteractions"

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

  const savedItems = useMemo(() => {
    return FEED_CATALOG.filter((item) => savedItemIds.has(item.id))
  }, [savedItemIds])

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
    await toggleSavedItem(user.id, itemId)
    if (onSavedUpdated) onSavedUpdated()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
            PERSONAL LEARNING LIBRARY
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Saved Challenges & Concepts
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {savedItems.length} bookmarked {savedItems.length === 1 ? "item" : "items"} available for offline study and revision.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("Home")}
            className="self-start sm:self-center flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs"
          >
            <span>← Back to Home</span>
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-4 dark:border-slate-800">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] ${
              activeCategory === cat
                ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Saved Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center dark:border-slate-800">
          <span className="text-4xl">🔖</span>
          <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
            No saved items in this category
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto dark:text-slate-400">
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
                className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {item.subject}
                    </span>
                    {isSolved && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ Solved
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {item.content}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    ⭐ +{item.xp_reward} XP
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveSave(item.id)}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-600 transition dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      Remove
                    </button>
                    {onOpenChallenge && (
                      <button
                        type="button"
                        onClick={() => onOpenChallenge(item)}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition dark:bg-blue-600 dark:hover:bg-blue-700"
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
