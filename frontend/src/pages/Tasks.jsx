import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { calculatePriority, getPriorityLabel } from "../utils/priority"
import { SkeletonList } from "../components/SkeletonLoader"
import EmptyState from "../components/EmptyState"
import ErrorState from "../components/ErrorState"

function Tasks({ user }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sortByPriority, setSortByPriority] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    title: "",
    subject: "",
    deadline: "",
    estimated_minutes: 30,
    importance: 5,
  })

  useEffect(() => {
    if (user?.id) {
      fetchTasks()
    }
  }, [user])

  async function fetchTasks() {
    setLoading(true)
    setError("")

    try {
      const { data, error: fetchErr } = await supabase
        .from("tasks")
        .select("id, user_id, title, subject, deadline, estimated_minutes, importance, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (fetchErr) throw fetchErr
      setTasks(data || [])
    } catch (err) {
      console.error(err)
      setError("Could not load tasks. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }

  async function addTask(e) {
    e.preventDefault()

    if (!form.title || !form.subject || !form.deadline) {
      setError("Please fill in all required fields.")
      return
    }

    if (!user?.id) return

    try {
      const { error: insertErr } = await supabase
        .from("tasks")
        .insert([
          {
            user_id: user.id,
            title: form.title.trim(),
            subject: form.subject.trim(),
            deadline: new Date(form.deadline).toISOString(),
            estimated_minutes: Number(form.estimated_minutes) || 30,
            importance: Number(form.importance) || 5,
            status: "pending",
          },
        ])

      if (insertErr) throw insertErr

      setForm({
        title: "",
        subject: "",
        deadline: "",
        estimated_minutes: 30,
        importance: 5,
      })

      setShowForm(false)
      setError("")
      fetchTasks()
    } catch (err) {
      console.error(err)
      setError(`Could not create task: ${err.message}`)
    }
  }

  async function completeTask(taskId) {
    try {
      // Optimistic update
      setTasks((curr) =>
        curr.map((t) => (t.id === taskId ? { ...t, status: "completed" } : t))
      )

      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", taskId)

      if (updateErr) throw updateErr
    } catch (err) {
      console.error(err)
      setError("Could not update task status.")
      fetchTasks()
    }
  }

  const displayedTasks = sortByPriority
    ? [...tasks].sort((a, b) => calculatePriority(b) - calculatePriority(a))
    : tasks

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              WORKLOAD & DELIVERABLES
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Academic Tasks & Assignments
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Track pending assignments and let the priority algorithm optimize your schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
            >
              <span>{showForm ? "✕ Close" : "+ New Task"}</span>
            </button>

            <button
              onClick={() => setSortByPriority(!sortByPriority)}
              className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition active:scale-[0.98] ${
                sortByPriority
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {sortByPriority ? "Sorted by Priority ✓" : "Sort by Priority"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState message={error} onRetry={fetchTasks} />
          </div>
        )}

        {/* Task Creation Form */}
        {showForm && (
          <form
            onSubmit={addTask}
            className="mb-8 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-md transition-all"
          >
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Add Academic Assignment / Task
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement AVL Tree in C++"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  Subject *
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
                  Deadline *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    Est. Minutes
                  </label>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={form.estimated_minutes}
                    onChange={(e) =>
                      setForm({ ...form, estimated_minutes: e.target.value })
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
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98]"
              >
                Save Task
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

        {/* Tasks List */}
        {loading ? (
          <SkeletonList count={4} />
        ) : displayedTasks.length === 0 ? (
          <EmptyState
            icon="✍️"
            title="No academic tasks recorded"
            description="Create your first assignment or lab record to keep your priorities synchronized."
            actionLabel="Add Task"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-3">
            {displayedTasks.map((task) => (
              <TaskRow key={task.id} task={task} completeTask={completeTask} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, completeTask }) {
  const priorityScore = calculatePriority(task)
  const priority = getPriorityLabel(priorityScore)

  const priorityStyles = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }

  const deadlineFormatted = task.deadline
    ? new Date(task.deadline).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No deadline"

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm sm:text-base font-bold text-slate-900 ${
                task.status === "completed" ? "line-through text-slate-400" : ""
              }`}
            >
              {task.title}
            </h3>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${priorityStyles[priority] || "bg-slate-100 text-slate-700"}`}
            >
              {priority} Priority
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-500 font-medium">{task.subject}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Score: {priorityScore}/10 · Importance {task.importance || 5}/10
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Deadline
            </p>
            <p className="mt-0.5 font-medium text-slate-800 font-mono text-xs">
              {deadlineFormatted}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Effort
            </p>
            <p className="mt-0.5 font-medium text-slate-800">
              {task.estimated_minutes || 30}m
            </p>
          </div>

          <button
            onClick={() => completeTask(task.id)}
            disabled={task.status === "completed"}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] ${
              task.status === "completed"
                ? "cursor-not-allowed bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            }`}
          >
            {task.status === "completed" ? "Completed ✓" : "Mark Done"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Tasks
