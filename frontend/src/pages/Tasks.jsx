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
  const [filterTab, setFilterTab] = useState("all") // "all" | "pending" | "completed"
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

    if (!form.title.trim() || !form.subject.trim() || !form.deadline) {
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
            estimated_minutes: Math.max(5, Number(form.estimated_minutes) || 30),
            importance: Math.max(1, Math.min(10, Number(form.importance) || 5)),
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

  async function toggleTaskStatus(task) {
    const nextStatus = task.status === "completed" ? "pending" : "completed"

    try {
      // Optimistic update
      setTasks((curr) =>
        curr.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      )

      const { error: updateErr } = await supabase
        .from("tasks")
        .update({ status: nextStatus })
        .eq("id", task.id)

      if (updateErr) throw updateErr
    } catch (err) {
      console.error(err)
      setError("Could not update task status.")
      fetchTasks()
    }
  }

  async function deleteTask(taskId) {
    if (!window.confirm("Are you sure you want to delete this task?")) return

    try {
      setTasks((curr) => curr.filter((t) => t.id !== taskId))

      const { error: delErr } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskId)
        .eq("user_id", user.id)

      if (delErr) throw delErr
    } catch (err) {
      console.error(err)
      setError("Could not delete task.")
      fetchTasks()
    }
  }

  const filteredTasks = tasks.filter((t) => {
    if (filterTab === "pending") return t.status !== "completed"
    if (filterTab === "completed") return t.status === "completed"
    return true
  })

  const displayedTasks = sortByPriority
    ? [...filteredTasks].sort((a, b) => calculatePriority(b) - calculatePriority(a))
    : filteredTasks

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
              WORKLOAD & DELIVERABLES
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Academic Tasks & Assignments
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 font-normal">
              Track pending coursework and let the Next Best Action engine optimize your study schedule.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:outline-none"
            >
              <span>{showForm ? "✕ Close" : "+ New Task"}</span>
            </button>

            <button
              onClick={() => setSortByPriority(!sortByPriority)}
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition active:scale-[0.98] ${
                sortByPriority
                  ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs"
              }`}
            >
              {sortByPriority ? "Priority Sorted ✓" : "Sort by Priority"}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-5 flex items-center gap-1.5 border-b border-slate-200/80 pb-3">
          {[
            { key: "all", label: `All (${tasks.length})` },
            { key: "pending", label: `Pending (${tasks.filter((t) => t.status !== "completed").length})` },
            { key: "completed", label: `Completed (${tasks.filter((t) => t.status === "completed").length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === tab.key
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
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
            className="mb-8 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm transition-all"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 active:scale-[0.98]"
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
            icon="📝"
            title={filterTab === "all" ? "No academic tasks recorded" : `No ${filterTab} tasks`}
            description="Create your first assignment or lab record to keep your priorities synchronized."
            actionLabel="Add Task"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="space-y-2.5">
            {displayedTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                toggleTaskStatus={toggleTaskStatus}
                deleteTask={deleteTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, toggleTaskStatus, deleteTask }) {
  const priorityScore = calculatePriority(task)
  const priority = getPriorityLabel(priorityScore)

  const priorityStyles = {
    High: "bg-rose-50 text-rose-700 border-rose-200/60",
    Medium: "bg-amber-50 text-amber-700 border-amber-200/60",
    Low: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition hover:border-slate-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${priorityStyles[priority] || "bg-slate-100 text-slate-700"}`}
            >
              {priority} Priority
            </span>
          </div>

          <p className="mt-0.5 text-xs text-slate-500 font-medium">{task.subject}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
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
              Est. Time
            </p>
            <p className="mt-0.5 font-medium text-slate-800">
              {task.estimated_minutes || 30}m
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleTaskStatus(task)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                task.status === "completed"
                  ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-2xs"
              }`}
            >
              {task.status === "completed" ? "Reopen" : "Complete ✓"}
            </button>

            <button
              onClick={() => deleteTask(task.id)}
              className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Delete task"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Tasks
