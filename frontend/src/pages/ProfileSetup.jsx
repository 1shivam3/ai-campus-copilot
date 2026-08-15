import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

function ProfileSetup({ user, onComplete }) {
  const [fullName, setFullName] = useState("")
  const [semester, setSemester] = useState("")
  const [section, setSection] = useState("")
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

  async function loadSections(selectedSemester) {
    setSection("")
    setSections([])

    if (!selectedSemester) {
      return
    }

    setSectionsLoading(true)
    setError("")

    const { data, error: fetchError } = await supabase
      .from("academic_sections")
      .select("section")
      .eq("semester", Number(selectedSemester))
      .order("section")

    if (fetchError) {
      console.error("Sections fetch error:", fetchError)
      setError("Could not load sections for the selected semester.")
      setSectionsLoading(false)
      return
    }

    setSections(data || [])
    setSectionsLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!fullName.trim() || !semester || !section) {
      setError("Please complete all fields.")
      return
    }

    setLoading(true)
    setError("")

    const { error: insertError } = await supabase
      .from("student_profiles")
      .insert({
        id: user.id,
        full_name: fullName.trim(),
        semester: Number(semester),
        section,
      })

    if (insertError) {
      console.error("Profile save error:", insertError)
      setError("Could not save your profile.")
      setLoading(false)
      return
    }

    setLoading(false)
    onComplete()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">

        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-blue-600">
            PROFILE SETUP
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Tell us about yourself
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This helps Campus Copilot load the correct timetable,
            labs and syllabus for your section.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Student Name
            </label>

            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Semester
            </label>

            <select
              value={semester}
              onChange={(e) => {
                const value = e.target.value
                setSemester(value)
                loadSections(value)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              required
            >
              <option value="">
                Select your semester
              </option>

              {semesters.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Section
            </label>

            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              disabled={!semester || sectionsLoading}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              required
            >
              <option value="">
                {!semester
                  ? "Select semester first"
                  : sectionsLoading
                    ? "Loading sections..."
                    : sections.length === 0
                      ? "No sections registered for this semester"
                      : "Select your section"}
              </option>

              {sections.map((item) => (
                <option
                  key={item.section}
                  value={item.section}
                >
                  Section {item.section}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
          >
            {loading
              ? "Saving..."
              : "Continue to Campus Copilot"}
          </button>

        </form>
      </div>
    </div>
  )
}

export default ProfileSetup
