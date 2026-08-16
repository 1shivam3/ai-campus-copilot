import { CoursePilotLogo } from "./CoursePilotLogo"

function Sidebar({
  currentPage,
  setCurrentPage,
  user,
  profile,
  onLogout,
  onOpenCalendar = () => {},
  onOpenNotifications = () => {},
  unreadCount = 0,
  mobileOpen = false,
  setMobileOpen = () => {},
}) {
  const menuItems = [
    {
      name: "Home",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: "My Academics",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: "Syllabus",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      name: "Progress",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: "Tasks",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: "Exams",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: "Exam Mode",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      name: "Study Material",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: "Focus Session",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: "Profile",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  const navContent = (
    <div className="flex h-full flex-col justify-between p-5">
      <div>
        {/* Brand Logo Wordmark */}
        <div className="mb-6 flex items-center justify-between">
          <CoursePilotLogo size="sm" showTagline={false} />

          {/* Close button for mobile drawer */}
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1" aria-label="Sidebar navigation">
          {menuItems.map((item) => {
            const isActive =
              currentPage === item.name ||
              (item.name === "Home" && currentPage === "Dashboard")
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setCurrentPage(item.name)
                  setMobileOpen(false)
                }}
                aria-current={isActive ? "page" : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98] ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span
                  className={`transition-colors ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.name}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Student Profile Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => {
            if (onOpenNotifications) onOpenNotifications()
            if (setMobileOpen) setMobileOpen(false)
          }}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <span>🔔</span>
            <span>Notifications</span>
          </div>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
              {unreadCount} new
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-semibold">Feed →</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setCurrentPage("Profile")
            if (setMobileOpen) setMobileOpen(false)
          }}
          className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-200/60 active:scale-[0.98]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white shadow-inner">
            {(profile?.full_name || user?.email || "S").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-xs font-bold text-slate-900"
              title={profile?.full_name || user?.email}
            >
              {profile?.full_name || user?.email?.split("@")[0] || "Student"}
            </p>
            {profile && (
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Sem {profile.semester} • Sec {profile.section}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-400 font-bold" title="Profile Settings">⚙️</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-100 active:scale-[0.98]"
        >
          Log out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200/80 bg-white lg:block">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Mobile Drawer Backdrop and Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[80vw] bg-white shadow-2xl transition-transform duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
