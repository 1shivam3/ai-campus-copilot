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
        .gte("exam_date", new Date().toISOString())
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

    if (!form.subject || !form.exam_date) {
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
          importance: Number(form.importance) || 5,
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

  function getDaysRemaining(date) {
    const diff = new Date(date).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              EXAM SCHEDULE & DEADLINES
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Upcoming Exams
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Your exam dates feed directly into the Exam Readiness and Exam Mode engines.
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
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
            className="mb-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md"
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Schedule New Exam
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
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
            icon="📝"
            title="No upcoming exams scheduled"
            description="Add your mid-term or end-semester exam dates to trigger adaptive review plans."
            actionLabel="Add Exam"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const days = getDaysRemaining(exam.exam_date)
              return (
                <div
                  key={exam.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  <p className="text-xs font-bold text-slate-500 uppercase truncate">
                    {exam.subject}
                  </p>

                  <p className="mt-3 text-3xl font-bold text-slate-900">{days}</p>
                  <p className="text-xs text-slate-400 font-medium">
                    {days === 1 ? "day remaining" : "days remaining"}
                  </p>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Importance</span>
                      <span className="font-bold text-slate-800">
                        {exam.importance || 5}/10
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-400">Date</span>
                      <span className="font-semibold text-slate-800">
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
