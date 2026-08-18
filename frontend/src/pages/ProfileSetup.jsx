import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { CoursePilotMark } from "../components/CoursePilotLogo"

function ProfileSetup({ user, onComplete }) {
  const [fullName, setFullName] = useState("")
  const [semester, setSemester] = useState("")
  const [section, setSection] = useState("")
  const [isCustomSection, setIsCustomSection] = useState(false)
  const [customSectionValue, setCustomSectionValue] = useState("")
  const [semesters, setSemesters] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [sectionsLoading, setSectionsLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    loadSemesters()
    loadExistingProfile()
  }, [])

  async function loadSemesters() {
    try {
      const { data, error } = await supabase
        .from("semesters")
        .select("semester_number, is_active")
        .order("semester_number")

      if (error) {
        setSemesters([
          { value: 1, label: "Semester 1" },
          { value: 2, label: "Semester 2" },
          { value: 3, label: "Semester 3" },
          { value: 4, label: "Semester 4" },
          { value: 5, label: "Semester 5" },
          { value: 6, label: "Semester 6" },
          { value: 7, label: "Semester 7" },
          { value: 8, label: "Semester 8" },
        ])
        return
      }

      if (data && data.length > 0) {
        setSemesters(
          data.map((s) => ({
            value: s.semester_number,
            label: `Semester ${s.semester_number}`,
          }))
        )
      } else {
        setSemesters([
          { value: 1, label: "Semester 1" },
          { value: 2, label: "Semester 2" },
          { value: 3, label: "Semester 3" },
          { value: 4, label: "Semester 4" },
          { value: 5, label: "Semester 5" },
          { value: 6, label: "Semester 6" },
          { value: 7, label: "Semester 7" },
          { value: 8, label: "Semester 8" },
        ])
      }
    } catch {
      setSemesters([
        { value: 1, label: "Semester 1" },
        { value: 2, label: "Semester 2" },
        { value: 3, label: "Semester 3" },
        { value: 4, label: "Semester 4" },
        { value: 5, label: "Semester 5" },
        { value: 6, label: "Semester 6" },
        { value: 7, label: "Semester 7" },
        { value: 8, label: "Semester 8" },
      ])
    }
  }

  async function loadExistingProfile() {
    try {
      const { data } = await supabase
        .from("student_profiles")
        .select("full_name, semester, section")
        .eq("id", user.id)
        .single()

      if (data) {
        if (data.full_name) setFullName(data.full_name)
        if (data.semester) {
          setSemester(String(data.semester))
          loadSections(String(data.semester), data.section)
        }
      }
    } catch {
      // No existing profile
    }
  }

  async function loadSections(semNum, preselectSection = null) {
    if (!semNum) {
      setSections([])
      return
    }

    setSectionsLoading(true)
    try {
      const { data, error } = await supabase
        .from("sections")
        .select("section, is_active")
        .eq("semester_number", parseInt(semNum, 10))
        .order("section")

      if (error) throw error

      if (data && data.length > 0) {
        setSections(data)
        if (preselectSection) {
          const match = data.find((s) => s.section === preselectSection)
          if (match) {
            setSection(preselectSection)
            setIsCustomSection(false)
          } else {
            setIsCustomSection(true)
            setCustomSectionValue(preselectSection)
          }
        }
      } else {
        setSections([
          { section: "B1" },
          { section: "B2" },
          { section: "B3" },
          { section: "B4" },
        ])
        if (preselectSection) setSection(preselectSection)
      }
    } catch (err) {
      console.warn("Could not load dynamic sections, using defaults:", err)
      setSections([
        { section: "B1" },
        { section: "B2" },
        { section: "B3" },
        { section: "B4" },
      ])
      if (preselectSection) setSection(preselectSection)
    } finally {
      setSectionsLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    const effectiveSection = isCustomSection
      ? customSectionValue.trim()
      : section.trim()

    if (!fullName.trim()) {
      setError("Please provide your full name.")
      return
    }
    if (!semester) {
      setError("Please select your current semester.")
      return
    }
    if (!effectiveSection) {
      setError("Please select or specify your section.")
      return
    }

    setLoading(true)

    try {
      const profileData = {
        id: user.id,
        full_name: fullName.trim(),
        semester: parseInt(semester, 10),
        section: effectiveSection,
        updated_at: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from("student_profiles")
        .upsert(profileData, { onConflict: "id" })

      if (upsertError) {
        console.error("Profile setup upsert error:", upsertError)
        setError(upsertError.message || "Failed to save profile. Please retry.")
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
    <div className="flex min-h-screen items-center justify-center bg-[#F7F7F2] p-4 sm:p-6 dark:bg-[#0f1416]">
      <div className="w-full max-w-lg rounded-3xl border border-[#E4E4E7] bg-white p-6 sm:p-8 shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f]">
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <CoursePilotMark className="h-7 w-7 shrink-0" />
            <p className="text-[11px] font-bold tracking-widest text-[#0F766E] uppercase dark:text-[#2DD4BF]">
              STUDENT ONBOARDING
            </p>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#18181B] sm:text-3xl dark:text-[#f4f4f5]">
            Tell us about yourself
          </h1>

          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#52525B] dark:text-[#a1a1aa]">
            This configures your academic timetable, enrolled subjects, faculty list, and syllabus topics automatically in CoursePilot.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52525B] mb-1.5 dark:text-[#a1a1aa]">
              Student Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Shivam Kumar"
              className="w-full rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-xs sm:text-sm font-medium text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52525B] mb-1.5 dark:text-[#a1a1aa]">
              Current Semester *
            </label>
            <select
              value={semester}
              onChange={(e) => {
                const value = e.target.value
                setSemester(value)
                loadSections(value)
              }}
              className="w-full rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#52525B] mb-1.5 dark:text-[#a1a1aa]">
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
                className="w-full rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 disabled:bg-[#F7F7F2] disabled:text-[#A1A1AA] dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
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
                  className="flex-1 rounded-xl border border-[#E4E4E7] bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-[#18181B] outline-none transition focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/20 dark:border-[#27343a] dark:bg-[#182226] dark:text-[#f4f4f5]"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomSection(false)
                    setCustomSectionValue("")
                  }}
                  className="rounded-xl border border-[#E4E4E7] bg-white px-3 py-3 text-xs font-semibold text-[#52525B] hover:bg-[#F7F7F2] transition dark:border-[#27343a] dark:bg-[#182226] dark:text-[#a1a1aa]"
                  title="Choose from list"
                >
                  List ▾
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs sm:text-sm font-medium text-[#DC2626] border border-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#0F766E] px-5 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-[#115E59] disabled:opacity-50 transition shadow-2xs active:scale-[0.98]"
          >
            {loading ? "Saving Profile..." : "Continue to CoursePilot →"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ProfileSetup
