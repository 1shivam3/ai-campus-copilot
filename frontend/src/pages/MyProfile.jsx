import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { getStoredTheme, applyTheme } from "../utils/theme"

const DEFAULT_SECTIONS = [
  "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2",
  "E1", "E2", "F1", "F2", "A", "B", "C", "D",
]

const SEMESTERS = [
  { value: 1, label: "1st Semester" },
  { value: 2, label: "2nd Semester" },
  { value: 3, label: "3rd Semester (Active CSE Timetable)" },
  { value: 4, label: "4th Semester" },
  { value: 5, label: "5th Semester" },
  { value: 6, label: "6th Semester" },
  { value: 7, label: "7th Semester" },
  { value: 8, label: "8th Semester" },
]

function MyProfile({ user, profile, onProfileUpdated, onNavigate }) {
  // Form State
  const [fullName, setFullName] = useState(profile?.full_name || "")
  const [semester, setSemester] = useState(profile?.semester ? String(profile.semester) : "3")
  const [section, setSection] = useState(profile?.section || "B2")
  const [collegeName, setCollegeName] = useState(profile?.college_name || "College of Engineering")
  const [program, setProgram] = useState(profile?.program || "Computer Science & Engineering")
  const [studentId, setStudentId] = useState(profile?.student_id || "")

  // Custom Section Toggle
  const [isCustomSection, setIsCustomSection] = useState(false)
  const [customSectionValue, setCustomSectionValue] = useState("")

  // Available Sections for selected semester
  const [availableSections, setAvailableSections] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(false)

  // Status & Feedback
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  // Theme State
  const [currentTheme, setCurrentTheme] = useState(() => getStoredTheme())

  // Initialize and populate values on profile change
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
      if (profile.semester) setSemester(String(profile.semester))
      if (profile.section) setSection(profile.section)
      if (profile.college_name) setCollegeName(profile.college_name)
      if (profile.program) setProgram(profile.program)
      if (profile.student_id) setStudentId(profile.student_id)
    }
  }, [profile])

  // Load sections when semester changes
  useEffect(() => {
    async function loadSections(semNumber) {
      if (!semNumber) return
      setSectionsLoading(true)
      try {
        const { data, error } = await supabase
          .from("academic_sections")
          .select("section")
          .eq("semester", Number(semNumber))
          .order("section")

        if (!error && data && data.length > 0) {
          setAvailableSections(data)
        } else {
          setAvailableSections(DEFAULT_SECTIONS.map((sec) => ({ section: sec })))
        }
      } catch {
        setAvailableSections(DEFAULT_SECTIONS.map((sec) => ({ section: sec })))
      } finally {
        setSectionsLoading(false)
      }
    }

    loadSections(semester)
  }, [semester])

  // Handle Theme Selection
  function handleThemeChange(themeKey) {
    setCurrentTheme(themeKey)
    applyTheme(themeKey)
  }

  // Handle Profile Save / Update
  async function handleSubmit(e) {
    e.preventDefault()
    setSuccessMessage("")
    setErrorMessage("")

    const finalName = fullName.trim()
    const finalSection = isCustomSection ? customSectionValue.trim() : section.trim()

    if (!finalName) {
      setErrorMessage("Please enter your full name.")
      return
    }

    if (!semester || !finalSection) {
      setErrorMessage("Please select your active semester and section.")
      return
    }

    if (!user?.id) {
      setErrorMessage("You must be logged in to update your profile.")
      return
    }

    setSaving(true)

    try {
      const updatePayload = {
        id: user.id,
        full_name: finalName,
        semester: Number(semester),
        section: finalSection,
        college_name: collegeName.trim() || null,
        program: program.trim() || null,
        student_id: studentId.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("student_profiles")
        .upsert(updatePayload, { onConflict: "id" })
        .select()
        .single()

      if (error) {
        throw error
      }

      setSuccessMessage("Your profile and academic preferences have been updated successfully!")
      if (onProfileUpdated) {
        onProfileUpdated(data || updatePayload)
      }

      // Hide success message after 4 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 4000)
    } catch (err) {
      console.error("Profile update error:", err)
      setErrorMessage(err.message || "Failed to update profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const initial = (fullName || user?.email || "S").charAt(0).toUpperCase()

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-blue-600 uppercase dark:text-blue-400">
              STUDENT PROFILE & PREFERENCES
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            My Profile & Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage your personal academic identity, curriculum cohort, and appearance settings.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("Dashboard")}
            className="self-start sm:self-center flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs"
          >
            <span>← Back to Dashboard</span>
          </button>
        )}
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-900 shadow-xs dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="text-xl">✅</span>
          <p className="text-xs sm:text-sm font-semibold">{successMessage}</p>
        </div>
      )}

      {/* Error Notification Banner */}
      {errorMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-900 shadow-xs dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300">
          <span className="text-xl">⚠️</span>
          <p className="text-xs sm:text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Profile Overview Hero Banner */}
      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Large Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-blue-600 to-indigo-700 text-3xl font-extrabold text-white shadow-md shadow-blue-500/20">
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white truncate">
                {fullName || "Student"}
              </h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                Active Student
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
              {user?.email || "No email connected"}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                📚 Semester {semester}
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                🏷️ Section {isCustomSection ? customSectionValue || section : section}
              </span>
              {program && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  🎓 {program}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Edit Details Form */}
        <div className="lg:col-span-2 space-y-8">
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 sm:p-7">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Academic & Personal Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Your timetable, subjects, and study windows dynamically map to your semester cohort.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:focus:bg-slate-800"
                />
              </div>

              {/* Semester & Section Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Semester */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Section <span className="text-red-500">*</span>
                  </label>
                  {!isCustomSection ? (
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      disabled={sectionsLoading}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white disabled:opacity-60"
                    >
                      {availableSections.map((sec) => (
                        <option key={sec.section} value={sec.section}>
                          Section {sec.section}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={customSectionValue}
                      onChange={(e) => setCustomSectionValue(e.target.value.toUpperCase())}
                      placeholder="e.g. CS-A"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                    />
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsCustomSection(!isCustomSection)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {isCustomSection ? "← Choose standard section" : "+ Enter custom section"}
                    </button>
                    {sectionsLoading && (
                      <span className="text-[10px] text-slate-400">Loading sections...</span>
                    )}
                  </div>
                </div>
              </div>

              {/* College & Department Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    College / Institute
                  </label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="e.g. College of Engineering"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Program / Branch
                  </label>
                  <input
                    type="text"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    placeholder="e.g. Computer Science & Engineering"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                  />
                </div>
              </div>

              {/* Student ID / Roll Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Student Roll Number / University ID (Optional)
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. 23CSE042"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white"
                />
              </div>

              {/* Submit Button */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-slate-900 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-slate-800 transition active:scale-[0.98] disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span>Save Profile Changes</span>
                      <span>✓</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right 1 Col: Appearance, Theme & Account Info */}
        <div className="space-y-8">
          {/* Appearance & Theme Selector */}
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 sm:p-7">
            <div className="mb-4">
              <span className="text-lg">🎨</span>
              <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                Appearance & Theme
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customize your visual reading and study experience.
              </p>
            </div>

            <div className="space-y-3">
              {/* Light Mode Option */}
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                  currentTheme === "light"
                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 text-lg dark:bg-amber-950/80 dark:text-amber-300">
                    ☀️
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Light Mode
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Crisp, high-contrast day theme
                    </p>
                  </div>
                </div>
                {currentTheme === "light" && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>

              {/* Dark Mode Option */}
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                  currentTheme === "dark"
                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-200 text-lg dark:bg-slate-700">
                    🌙
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Dark Mode
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Deep obsidian theme for night study
                    </p>
                  </div>
                </div>
                {currentTheme === "dark" && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>

              {/* System Default Option */}
              <button
                type="button"
                onClick={() => handleThemeChange("system")}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                  currentTheme === "system"
                    ? "border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-200 text-slate-700 text-lg dark:bg-slate-800 dark:text-slate-300">
                    💻
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      System Sync
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Matches your operating system
                    </p>
                  </div>
                </div>
                {currentTheme === "system" && (
                  <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            </div>
          </section>

          {/* Account & Data Isolation Info */}
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 sm:p-7">
            <div className="mb-4">
              <span className="text-lg">🛡️</span>
              <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                Account & Security
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-tenant data isolation protected by Supabase RLS.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Email</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
                  {user?.email || "Authenticated User"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Tenant Security</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  RLS Enforced
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Account ID</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">
                  {user?.id ? `${user.id.slice(0, 12)}...` : "—"}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default MyProfile
