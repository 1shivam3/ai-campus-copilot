import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { CoursePilotMark } from "../components/CoursePilotLogo"

const DEFAULT_SECTIONS = [
  "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2",
  "E1", "E2", "F1", "F2", "A", "B", "C", "D"
]

function ProfileSetup({ user, onComplete }) {
  const [fullName, setFullName] = useState("")
  const [semester, setSemester] = useState("")
  const [section, setSection] = useState("")
  const [isCustomSection, setIsCustomSection] = useState(false)
  const [customSectionValue, setCustomSectionValue] = useState("")
  const [sections, setSections] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const semesters = [
    { value: 1, label: "1st Semester" },
    { value: 2, label: "2nd Semester" },
    { value: 3, label: "3rd Semester" },
    { value: 4, label: "4th Semester" },
    { value: 5, label: "5th Semester" },
    { value: 6, label: "6th Semester" },
    { value: 7, label: "7th Semester" },
    { value: 8, label: "8th Semester" },
  ]

  // Pre-populate if existing profile is found
  useEffect(() => {
    async function loadExistingProfile() {
      if (!user?.id) return
      try {
        const { data } = await supabase
          .from("student_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

        if (data) {
          if (data.full_name) setFullName(data.full_name)
          if (data.semester) {
            setSemester(String(data.semester))
            await loadSections(data.semester)
          }
          if (data.section) {
            setSection(data.section)
          }
        }
      } catch (err) {
        console.warn("Notice: could not load existing profile values", err)
      }
    }
    loadExistingProfile()
  }, [user])

  async function loadSections(selectedSemester) {
    setSection("")
    setIsCustomSection(false)
    setCustomSectionValue("")
    setSections([])

    if (!selectedSemester) return

    setSectionsLoading(true)
    setError("")

    try {
      const { data, error: fetchError } = await supabase
        .from("academic_sections")
        .select("section")
        .eq("semester", Number(selectedSemester))
        .order("section")

      if (fetchError || !data || data.length === 0) {
        // Use standard default sections fallback
        setSections(DEFAULT_SECTIONS.map((sec) => ({ section: sec })))
      } else {
        setSections(data)
      }
    } catch (err) {
      console.warn("Using fallback sections:", err)
      setSections(DEFAULT_SECTIONS.map((sec) => ({ section: sec })))
    } finally {
      setSectionsLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const finalSection = isCustomSection ? customSectionValue.trim() : section.trim()

    if (!fullName.trim() || !semester || !finalSection) {
      setError("Please complete all fields.")
      return
    }

    if (!user?.id) {
      setError("No authenticated user found. Please re-login.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { error: upsertError } = await supabase
        .from("student_profiles")
        .upsert(
          {
            id: user.id,
            full_name: fullName.trim(),
            semester: Number(semester),
            section: finalSection,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )

      if (upsertError) {
        console.error("Profile save error:", upsertError)
        setError(`Could not save profile: ${upsertError.message}`)
        setLoading(false)
        return
      }

      setLoading(false)
      onComplete()
    } catch (err) {
      console.error("Profile save catch error:", err)
      setError("An unexpected error occurred while saving your profile.")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <CoursePilotMark className="h-7 w-7 shrink-0" />
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              STUDENT ONBOARDING
            </p>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tell us about yourself
          </h1>

          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
            This configures your academic timetable, enrolled subjects, faculty list, and syllabus topics automatically in CoursePilot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Student Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Shivam Kumar"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Current Semester *
            </label>
            <select
              value={semester}
              onChange={(e) => {
                const value = e.target.value
                setSemester(value)
                loadSections(value)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              required
            >
              <option value="">Select your semester</option>
              {semesters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Assigned Section *
            </label>
            {!isCustomSection ? (
              <select
                value={section}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setIsCustomSection(true)
                    setSection("")
                  } else {
                    setSection(e.target.value)
                  }
                }}
                disabled={!semester || sectionsLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:text-slate-400"
                required={!isCustomSection}
              >
                <option value="">
                  {!semester
                    ? "Select semester first"
                    : sectionsLoading
                      ? "Loading sections..."
                      : "Select your section"}
                </option>
                {sections.map((item) => (
                  <option key={item.section} value={item.section}>
                    Section {item.section}
                  </option>
                ))}
                {semester && (
                  <option value="__custom__">✏️ Other / Custom Section...</option>
                )}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customSectionValue}
                  onChange={(e) => setCustomSectionValue(e.target.value)}
                  placeholder="e.g. A1, CSE-1, or Alpha"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSection(false)
                    setCustomSectionValue("")
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  title="Choose from list"
                >
                  List ▾
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-xs sm:text-sm font-medium text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm active:scale-[0.98]"
          >
            {loading ? "Saving Profile..." : "Continue to CoursePilot →"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfileSetup
