import { useState, useEffect, memo } from "react"

function MobileBottomNav({
  currentPage,
  setCurrentPage,
  user,
  profile,
  onLogout,
  onOpenCalendar,
  onOpenNotifications,
  unreadCount = 0,
}) {
  const [moreOpen, setMoreOpen] = useState(false)

  // Close "More" sheet when page changes
  useEffect(() => {
    setMoreOpen(false)
  }, [currentPage])

  // Close "More" sheet on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setMoreOpen(false)
      }
    }
    if (moreOpen) {
      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }
  }, [moreOpen])

  // Primary 4 fixed destinations + More
  const primaryTabs = [
    {
      id: "Home",
      label: "Home",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "My Academics",
      label: "Academics",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: "Tasks",
      label: "Tasks",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
    {
      id: "Progress",
      label: "Progress",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
  ]

  // Remaining pages accessible via the "More" bottom sheet
  const moreItems = [
    {
      id: "Syllabus",
      label: "Syllabus",
      desc: "Course curriculum & topic breakdown",
      icon: (
        <svg className="h-5 w-5 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
    },
    {
      id: "Exams",
      label: "Exams",
      desc: "Datesheet & weightage tracking",
      icon: (
        <svg className="h-5 w-5 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: "Exam Mode",
      label: "Exam Mode",
      desc: "High-yield revision & quizzes",
      icon: (
        <svg className="h-5 w-5 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      id: "Leaderboard",
      label: "Campus Leaderboard",
      desc: "Global rank, streaks & verified XP",
      icon: (
        <svg className="h-5 w-5 text-[#C49A3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "Saved",
      label: "Saved Challenges",
      desc: "Bookmarked questions & concepts",
      icon: (
        <svg className="h-5 w-5 text-[#0F766E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      id: "Profile",
      label: "My Profile & Settings",
      desc: "Edit personal info, cohort & dark mode",
      icon: (
        <svg className="h-5 w-5 text-[#18181B] dark:text-[#f4f4f5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ]

  const isMoreActive = moreItems.some((item) => item.id === currentPage)

  return (
    <>
      {/* EXPANDABLE "MORE" BOTTOM SHEET OVERLAY */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-[#18181B]/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-[#E4E4E7] bg-white p-5 shadow-2xl transition-all dark:border-[#27343a] dark:bg-[#141c1f]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Drag Handle & Header */}
            <div className="mx-auto h-1.5 w-12 rounded-full bg-[#E4E4E7] mb-4 dark:bg-[#27343a]" />

            <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3 mb-4 dark:border-[#27343a]">
              <div>
                <h3 className="text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  Academic Features & Tools
                </h3>
                <p className="text-xs text-[#52525B] dark:text-[#a1a1aa]">
                  Semester {profile?.semester || "3"} · Section {profile?.section || ""}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-full bg-[#F7F7F2] p-1.5 text-[#52525B] hover:bg-[#E4E4E7] text-xs font-bold dark:bg-[#182226] dark:text-[#a1a1aa]"
              >
                ✕
              </button>
            </div>

            {/* Grid of Navigation Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {moreItems.map((item) => {
                const isActive = currentPage === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setCurrentPage(item.id)
                      setMoreOpen(false)
                    }}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                      isActive
                        ? "border-[#0F766E] bg-[#ECFDF5] shadow-2xs dark:bg-[#182226] dark:border-[#2DD4BF]"
                        : "border-[#E4E4E7] bg-[#F7F7F2] hover:bg-white dark:border-[#27343a] dark:bg-[#182226] dark:hover:bg-[#1e2c31]"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs border border-[#E4E4E7] dark:bg-[#141c1f] dark:border-[#27343a]">
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#18181B] truncate dark:text-[#f4f4f5]">
                          {item.label}
                        </h4>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E] dark:bg-[#2DD4BF]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#52525B] line-clamp-1 mt-0.5 dark:text-[#a1a1aa]">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Quick Actions Row in Bottom Sheet */}
            <div className="border-t border-[#E4E4E7] pt-3 space-y-2 dark:border-[#27343a]">
              <button
                type="button"
                onClick={() => {
                  if (onOpenNotifications) onOpenNotifications()
                  setMoreOpen(false)
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-[#E4E4E7] bg-[#F7F7F2] py-2.5 text-xs font-bold text-[#18181B] hover:bg-white transition dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
              >
                <span>🔔</span>
                <span>Notifications & Alerts {unreadCount > 0 ? `(${unreadCount})` : ""}</span>
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50/60 py-2 text-center text-xs font-bold text-[#DC2626] hover:bg-rose-100 transition dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FIXED MOBILE BOTTOM TASKBAR */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[#E4E4E7] bg-white/95 px-2 backdrop-blur-md shadow-lg pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-[#27343a] dark:bg-[#0f1416]/95"
        aria-label="Mobile Bottom Navigation"
      >
        {primaryTabs.map((tab) => {
          const isActive =
            currentPage === tab.id ||
            (tab.id === "Home" && (currentPage === "Home" || currentPage === "Dashboard"))
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentPage(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                isActive
                  ? "text-[#0F766E] font-bold dark:text-[#2DD4BF]"
                  : "text-[#52525B] hover:text-[#18181B] font-medium dark:text-[#a1a1aa] dark:hover:text-white"
              }`}
            >
              <span className={`relative transition-transform ${isActive ? "scale-110" : ""}`}>
                {tab.icon}
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#0F766E] dark:bg-[#2DD4BF]" />
                )}
              </span>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
            </button>
          )
        })}

        {/* "More" Tab Button */}
        <button
          type="button"
          onClick={() => setMoreOpen((prev) => !prev)}
          className={`flex flex-1 flex-col items-center justify-center py-1 transition-all active:scale-95 ${
            isMoreActive || moreOpen
              ? "text-[#0F766E] font-bold dark:text-[#2DD4BF]"
              : "text-[#52525B] hover:text-[#18181B] font-medium dark:text-[#a1a1aa] dark:hover:text-white"
          }`}
        >
          <span className={`relative transition-transform ${isMoreActive || moreOpen ? "scale-110" : ""}`}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            {isMoreActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-[#0F766E] dark:bg-[#2DD4BF]" />
            )}
          </span>
          <span className="text-[10px] tracking-tight mt-0.5">More</span>
        </button>
      </nav>
    </>
  )
}

export default memo(MobileBottomNav)
