import { useEffect, useState, useRef, useCallback } from "react"
import { searchAcademicWorkspace } from "../lib/api"

const RECENT_SEARCHES_KEY = "coursepilot_recent_searches"
const QUICK_SUGGESTIONS = [
  "my upcoming exams",
  "pending tasks",
  "linked lists",
  "normalization",
  "trees",
  "flashcards",
]

function GlobalSearch({ isOpen, onClose, user, profile, onNavigate }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState([])

  const inputRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // ---------------------------------------------------------
  // 1. LOAD RECENT SEARCHES
  // ---------------------------------------------------------
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        setRecentSearches(JSON.parse(stored))
      }
    } catch (e) {
      console.warn("Could not read recent searches:", e)
    }
  }, [])

  function saveRecentSearch(searchStr) {
    if (!searchStr || searchStr.trim().length < 2) return
    const clean = searchStr.trim()
    try {
      const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 5)
      setRecentSearches(updated)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
    } catch (e) {
      console.warn("Could not save recent search:", e)
    }
  }

  function clearRecentSearches() {
    setRecentSearches([])
    localStorage.removeItem(RECENT_SEARCHES_KEY)
  }

  // ---------------------------------------------------------
  // 2. FOCUS INPUT ON OPEN
  // ---------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setResults([])
      setError("")
      setSelectedIndex(0)
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // ---------------------------------------------------------
  // 3. DEBOUNCED SEARCH EXECUTION
  // ---------------------------------------------------------
  const executeSearch = useCallback(
    async (searchQuery) => {
      if (!searchQuery || searchQuery.trim().length < 2 || !user?.id) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)
      setError("")

      try {
        const res = await searchAcademicWorkspace({
          query: searchQuery,
          userId: user.id,
          semester: profile?.semester,
          section: profile?.section,
          limit: 25,
        })

        if (res?.results) {
          setResults(res.results)
          setSelectedIndex(0)
        }
      } catch (err) {
        console.error("Global search error:", err)
        setError("Search request failed. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [user?.id, profile?.semester, profile?.section]
  )

  const handleQueryChange = (e) => {
    const val = e.target.value
    setQuery(val)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (val.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val)
    }, 300)
  }

  // ---------------------------------------------------------
  // 4. KEYBOARD NAVIGATION & SHORTCUTS
  // ---------------------------------------------------------
  const handleItemClick = (item) => {
    saveRecentSearch(query || item.title)
    if (onNavigate) {
      onNavigate(item.type, item.metadata)
    }
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length)
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
      }
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (results.length > 0 && results[selectedIndex]) {
        handleItemClick(results[selectedIndex])
      }
    }
  }

  if (!isOpen) return null

  // ---------------------------------------------------------
  // 5. GROUP RESULTS BY CATEGORY
  // ---------------------------------------------------------
  const groupedResults = {
    syllabus: results.filter((r) => r.type === "syllabus"),
    study_material: results.filter((r) => r.type === "study_material"),
    previous_paper: results.filter((r) => r.type === "previous_paper"),
    flashcard: results.filter((r) => r.type === "flashcard"),
    task: results.filter((r) => r.type === "task"),
    exam: results.filter((r) => r.type === "exam"),
  }

  const categoryMeta = {
    syllabus: { label: "Syllabus Topics", icon: "📘", color: "text-blue-600" },
    study_material: { label: "Study Material", icon: "📄", color: "text-indigo-600" },
    previous_paper: { label: "Previous-Year Papers", icon: "📊", color: "text-emerald-600" },
    flashcard: { label: "Flashcards", icon: "🎴", color: "text-purple-600" },
    task: { label: "Tasks & Assignments", icon: "✅", color: "text-amber-600" },
    exam: { label: "Exams & Tests", icon: "📅", color: "text-rose-600" },
  }

  let flatIndexTracker = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 md:p-12 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl transform overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-100 px-4 sm:px-6 py-4">
          <span className="text-lg mr-3 text-slate-400">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search syllabus, notes, past papers, tasks, exams, flashcards... (Esc to exit)"
            value={query}
            onChange={handleQueryChange}
            className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
          />

          {loading && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setResults([])
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-xs"
            >
              ✕
            </button>
          )}

          <div className="ml-2 hidden sm:flex items-center gap-1">
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 shadow-2xs">
              Esc
            </kbd>
          </div>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quick Suggestions & Recent Searches (When search query is empty) */}
          {!query && (
            <div className="space-y-4">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      RECENT SEARCHES
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setQuery(term)
                          executeSearch(term)
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition"
                      >
                        🕒 {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  TRY SEARCHING FOR
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setQuery(sug)
                        executeSearch(sug)
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition shadow-2xs"
                    >
                      ✦ {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              ⚠️ {error}
            </div>
          )}

          {/* Grouped Results Display */}
          {query.trim().length >= 2 && results.length > 0 && (
            <div className="space-y-5">
              {Object.entries(groupedResults).map(([catKey, items]) => {
                if (!items || items.length === 0) return null
                const meta = categoryMeta[catKey] || { label: catKey, icon: "📁", color: "text-slate-600" }

                return (
                  <div key={catKey} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
                        {items.length}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {items.map((item) => {
                        flatIndexTracker += 1
                        const isSelected = flatIndexTracker === selectedIndex

                        return (
                          <div
                            key={`${item.type}-${item.title}-${flatIndexTracker}`}
                            onClick={() => handleItemClick(item)}
                            className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50/60 shadow-xs"
                                : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {item.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 truncate leading-relaxed">
                                {item.subtitle}
                              </p>
                            </div>

                            <span className="text-xs font-bold text-blue-600 shrink-0">
                              Open ↗
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty / No Results State */}
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="py-8 text-center space-y-2">
              <span className="text-3xl">🔍</span>
              <h4 className="font-bold text-slate-900 text-sm">
                No results found for &ldquo;{query}&rdquo;
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Try searching for a subject name, a syllabus topic, a study note, an assignment, an exam, or a flashcard keyword.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6 py-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>

          <span>CoursePilot Unified Search</span>
        </div>
      </div>
    </div>
  )
}

export default GlobalSearch
