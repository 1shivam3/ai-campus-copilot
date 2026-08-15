import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { calculatePriority, getPriorityLabel } from "../utils/priority"

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

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setError("Could not load tasks.")
    } else {
      setTasks(data || [])
    }

    setLoading(false)
  }

  async function addTask(e) {
    e.preventDefault()

    if (!form.title || !form.subject || !form.deadline) {
      setError("Please fill in all required fields.")
      return
    }

    if (!user?.id) {
      setError("You must be logged in to add a task.")
      return
    }

    const { error } = await supabase
      .from("tasks")
      .insert([
        {
          user_id: user.id,
          title: form.title,
          subject: form.subject,
          deadline: new Date(form.deadline).toISOString(),
          estimated_minutes: Number(form.estimated_minutes),
          importance: Number(form.importance),
          status: "pending",
        },
      ])

    if (error) {
      console.error(error)
      setError(`Could not add task: ${error.message}`)
      return
    }

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
  }

  async function completeTask(taskId) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId)

    if (error) {
      console.error(error)
      setError("Could not update task.")
      return
    }

    fetchTasks()
  }

  const displayedTasks = sortByPriority
    ? [...tasks].sort((a, b) => calculatePriority(b) - calculatePriority(a))
    : tasks

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Academic Tasks
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Your Tasks
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Tasks loaded directly from your Supabase database.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Add Task
          </button>

          <button
            onClick={() => setSortByPriority(!sortByPriority)}
            className={`rounded-xl border px-5 py-3 text-sm font-semibold transition ${
              sortByPriority
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {sortByPriority ? "Sorted by Priority ✓" : "Sort by Priority"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={addTask}
            className="mb-6 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <h2 className="mb-5 text-lg font-bold">
              Add New Task
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                placeholder="Task title"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="text"
                placeholder="Subject"
                value={form.subject}
                onChange={(e) =>
                  setForm({ ...form, subject: e.target.value })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="datetime-local"
                value={form.deadline}
                onChange={(e) =>
                  setForm({ ...form, deadline: e.target.value })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="number"
                min="5"
                placeholder="Estimated minutes"
                value={form.estimated_minutes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimated_minutes: e.target.value,
                  })
                }
                className="rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-900"
              />

              <input
                type="number"
                min="1"
                max="10"
                placeholder="Importance 1-10"
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
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Save Task
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border px-5 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading && (
          <div className="rounded-2xl border bg-white p-6">
            Loading tasks...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && displayedTasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="font-semibold text-slate-700">No tasks found</p>
            <p className="mt-1 text-sm text-slate-500">
              Click &quot;+ Add Task&quot; above to create your first academic task!
            </p>
          </div>
        )}

        {!loading && !error && displayedTasks.length > 0 && (
          <div className="space-y-4">
            {displayedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                completeTask={completeTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, completeTask }) {
  const priorityScore = calculatePriority(task)
  const priority = getPriorityLabel(priorityScore)

  const priorityStyles = {
    High: "bg-red-50 text-red-700",
    Medium: "bg-amber-50 text-amber-700",
    Low: "bg-emerald-50 text-emerald-700",
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
    <div className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`font-semibold text-slate-900 ${task.status === "completed" ? "line-through text-slate-400" : ""}`}>
              {task.title}
            </h2>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityStyles[priority]}`}
            >
              {priority}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {task.subject}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Priority score: {priorityScore}/10
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <p className="text-xs text-slate-400">Deadline</p>
            <p className="mt-1 font-medium">{deadlineFormatted}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400">Estimated Time</p>
            <p className="mt-1 font-medium">{task.estimated_minutes} min</p>
          </div>

          <button
            onClick={() => completeTask(task.id)}
            disabled={task.status === "completed"}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              task.status === "completed"
                ? "cursor-not-allowed bg-emerald-50 text-emerald-700"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {task.status === "completed" ? "Completed ✓" : "Complete"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Tasks
