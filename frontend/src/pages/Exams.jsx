import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

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

    const { data, error } = await supabase
      .from("exams")
      .select("*")
      .eq("user_id", user.id)
      .gte("exam_date", new Date().toISOString())
      .order("exam_date", { ascending: true })

    if (error) {
      console.error(error)
      setError("Could not load exams.")
    } else {
      setExams(data || [])
      setError("")
    }

    setLoading(false)
  }

  async function addExam(e) {
    e.preventDefault()

    if (!form.subject || !form.exam_date) {
      setError("Please fill in all required fields.")
      return
    }

    if (!user?.id) {
      setError("You must be logged in to add an exam.")
      return
    }

    const { error } = await supabase
      .from("exams")
      .insert([
        {
          user_id: user.id,
          subject: form.subject,
          exam_date: new Date(form.exam_date).toISOString(),
          importance: Number(form.importance),
        },
      ])

    if (error) {
      console.error(error)
      setError(`Could not add exam: ${error.message}`)
      return
    }

    setForm({
      subject: "",
      exam_date: "",
      importance: 5,
    })

    setShowForm(false)
    setError("")
    fetchExams()
  }

  function getDaysRemaining(date) {
    const now = new Date()
    const examDate = new Date(date)

    const difference =
      examDate.getTime() - now.getTime()

    return Math.max(
      0,
      Math.ceil(difference / (1000 * 60 * 60 * 24))
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Academic Calendar
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Upcoming Exams
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Track your exams so the copilot can understand your
            academic deadlines.
          </p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            + Add Exam
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={addExam}
            className="mb-6 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-bold">
              Add Exam
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <input
                type="text"
                placeholder="Subject"
                value={form.subject}
                onChange={(e) =>
                  setForm({
                    ...form,
                    subject: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="datetime-local"
                value={form.exam_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    exam_date: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="number"
                min="1"
                max="10"
                value={form.importance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    importance: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Save Exam
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border bg-white p-6">
            Loading exams...
          </div>
        ) : exams.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center">
            <h2 className="font-semibold text-slate-800">
              No upcoming exams
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Add an exam so the copilot can prioritize your study.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exams.map((exam) => {
              const days = getDaysRemaining(exam.exam_date)

              return (
                <div
                  key={exam.id}
                  className="rounded-2xl border bg-white p-6 shadow-sm hover:border-slate-300 transition"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {exam.subject}
                  </p>

                  <p className="mt-3 text-3xl font-bold">
                    {days}
                  </p>

                  <p className="text-sm text-slate-500">
                    {days === 1 ? "day remaining" : "days remaining"}
                  </p>

                  <div className="mt-5 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Importance
                      </span>

                      <span className="font-semibold">
                        {exam.importance}/10
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Exam date
                      </span>

                      <span className="font-semibold">
                        {new Date(
                          exam.exam_date
                        ).toLocaleDateString()}
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
