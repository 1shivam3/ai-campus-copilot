import { useState } from "react"
import { supabase } from "../lib/supabase"

function ProfileSetup({ user, onComplete }) {
  const [fullName, setFullName] = useState("")
  const [semester, setSemester] = useState("")
  const [section, setSection] = useState("")
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

  const sections = Array.from(
    { length: 12 },
    (_, index) => {
      const letter = String.fromCharCode(65 + index)

      return [
        `${letter}1`,
        `${letter}2`,
      ]
    }
  ).flat()

  async function handleSubmit(e) {
    e.preventDefault()

    if (!fullName.trim() || !semester || !section) {
      setError("Please complete all fields.")
      return
    }

    setLoading(true)
    setError("")

    const { error } = await supabase
      .from("student_profiles")
      .insert({
        id: user.id,
        full_name: fullName.trim(),
        semester: Number(semester),
        section,
      })

    if (error) {
      console.error(error)
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
            labs and syllabus for you.
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
              onChange={(e) => setSemester(e.target.value)}
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
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              required
            >
              <option value="">
                Select your section
              </option>

              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
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
