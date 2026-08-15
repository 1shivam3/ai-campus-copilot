function Sidebar({ currentPage, setCurrentPage, user, profile, onLogout }) {
  const menuItems = [
    "Dashboard",
    "My Academics",
    "Syllabus",
    "Tasks",
    "Exams",
    "Exam Mode",
    "Study Material",
    "AI Copilot",
    "Focus Session",
  ]

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200/80 bg-white lg:block">
      <div className="sticky top-0 h-screen p-5 flex flex-col justify-between">
        <div>
          <div className="mb-8">
            <h1 className="text-lg font-bold text-slate-900">AI Campus Copilot</h1>
            <p className="mt-1 text-xs text-slate-500">
              Your academic command center
            </p>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item}
                onClick={() => setCurrentPage(item)}
                className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  currentPage === item
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
          <p className="text-xs font-semibold tracking-wider text-slate-400">
            STUDENT PROFILE
          </p>

          <p className="mt-1 truncate text-sm font-bold text-slate-900" title={profile?.full_name || user?.email}>
            {profile?.full_name || user?.email || "Student"}
          </p>

          {profile && (
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Sem {profile.semester} • Section {profile.section}
            </p>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
