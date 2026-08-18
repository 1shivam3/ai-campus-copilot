import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { SkeletonGrid } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function Exams({ user }) {
  const [exams, setExams] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    subject: "",
    exam_date: "",
    importance: 5,
  })

  useEffect(() => {
    if (user?.id) {
      fetchExams()
    }
  }, [user])

  async function fetchExams() {
    setLoading(true)
    setError("")

    try {
      const { data, error: fetchErr } = await supabase
        .from("exams")
        .select("id, subject, exam_date, importance, created_at")
        .eq("user_id", user.id)
        .gte("exam_date", new Date(Date.now() - 86400000).toISOString()) // Include today
        .order("exam_date", { ascending: true })

      if (fetchErr) throw fetchErr
      setExams(data || [])
    } catch (err) {
      console.error(err)
      setError("Could not load upcoming exams.")
    } finally {
      setLoading(false)
    }
  }

  async function addExam(e) {
    e.preventDefault()

    if (!form.subject.trim() || !form.exam_date) {
      setError("Please fill in all required fields.")
      return
    }

    if (!user?.id) return

    try {
      const { error: insertErr } = await supabase.from("exams").insert([
        {
          user_id: user.id,
          subject: form.subject.trim(),
          exam_date: new Date(form.exam_date).toISOString(),
          importance: Math.max(1, Math.min(10, Number(form.importance) || 5)),
        },
      ])

      if (insertErr) throw insertErr

      setForm({
        subject: "",
        exam_date: "",
        importance: 5,
      })

      setShowForm(false)
      setError("")
      fetchExams()
    } catch (err) {
      console.error(err)
      setError(`Could not add exam: ${err.message}`)
    }
  }

  async function deleteExam(examId) {
    if (!window.confirm("Are you sure you want to remove this exam?")) return

    try {
      setExams((curr) => curr.filter((e) => e.id !== examId))

      const { error: delErr } = await supabase
        .from("exams")
        .delete()
        .eq("id", examId)
        .eq("user_id", user.id)

      if (delErr) throw delErr
    } catch (err) {
      console.error(err)
      setError("Could not delete exam.")
      fetchExams()
    }
  }

  function getDaysRemaining(date) {
    const diff = new Date(date).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
              EXAM SCHEDULE & READINESS
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Upcoming Examinations
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal">
              Your exam dates feed directly into the Next Best Action and Exam Mode engines.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
          >
            <span>{showForm ? "✕ Close" : "+ New Exam"}</span>
          </button>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={fetchExams} />
          </div>
        )}

        {/* Add Exam Modal/Form */}
        {showForm && (
          <form
            onSubmit={addExam}
            className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all"
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Schedule New Examination
            </h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Exam Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.exam_date}
                  onChange={(e) =>
                    setForm({ ...form, exam_date: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Importance (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.importance}
                  onChange={(e) =>
                    setForm({ ...form, importance: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
              >
                Save Exam
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Exams Grid */}
        {loading ? (
          <SkeletonGrid count={3} />
        ) : exams.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No upcoming exams scheduled"
            description="Add your mid-term or end-semester exam dates so CoursePilot can calculate your preparation priorities."
            actionLabel="Add Exam"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const days = getDaysRemaining(exam.exam_date)
              const isImminent = days <= 3

              return (
                <div
                  key={exam.id}
                  className="relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300"
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isImminent
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                          : "bg-blue-50 text-blue-700 border border-blue-200/60"
                      }`}
                    >
                      {isImminent ? "Approaching" : "Upcoming"}
                    </span>

                    <button
                      onClick={() => deleteExam(exam.id)}
                      className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Delete exam"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-slate-900 truncate">
                    {exam.subject}
                  </h3>

                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-extrabold text-slate-900">
                      {days}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {days === 1 ? "day remaining" : "days remaining"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Importance</span>
                      <span className="font-bold text-slate-800">
                        {exam.importance || 5}/10
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Exam Date</span>
                      <span className="font-semibold text-slate-800 font-mono text-xs">
                        {new Date(exam.exam_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Exams
