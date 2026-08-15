import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { calculateNewMastery } from "../utils/mastery"

function FocusSession({ user, recommendedTaskId }) {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState("")
  const [minutes, setMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadTasks()
    }
  }, [user, recommendedTaskId])

  useEffect(() => {
    if (!running || secondsLeft <= 0) {
      if (secondsLeft === 0 && running) {
        finishSession()
      }

      return
    }

    const timer = setInterval(() => {
      setSecondsLeft((previous) => previous - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [running, secondsLeft])

  async function loadTasks() {
    if (!user?.id) return

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("deadline", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    const fetchedTasks = data || []
    setTasks(fetchedTasks)

    if (fetchedTasks.length > 0) {
      const recommendedExists = fetchedTasks.some(
        (task) => String(task.id) === String(recommendedTaskId)
      )

      if (recommendedTaskId && recommendedExists) {
        setSelectedTask(String(recommendedTaskId))
      } else {
        setSelectedTask(String(fetchedTasks[0].id))
      }
    }
  }

  function changeDuration(value) {
    setMinutes(value)
    setSecondsLeft(value * 60)
    setRunning(false)
    setCompleted(false)
  }

  function startSession() {
    if (!selectedTask) return

    setCompleted(false)
    setSecondsLeft(minutes * 60)
    setRunning(true)
  }

  function pauseSession() {
    setRunning(false)
  }

  function resetSession() {
    setRunning(false)
    setSecondsLeft(minutes * 60)
    setCompleted(false)
  }

  async function finishSession() {
    setRunning(false)
    setCompleted(true)

    if (!user?.id) {
      console.error("User not found for session recording.")
      return
    }

    const { error: sessionError } = await supabase
      .from("study_sessions")
      .insert([
        {
          user_id: user.id,
          task_id: Number(selectedTask),
          duration_minutes: minutes,
          completed: true,
        },
      ])

    if (sessionError) {
      console.error(sessionError)
      return
    }

    const task = tasks.find(
      (item) => String(item.id) === selectedTask
    )

    if (!task) return

    const { data: topics, error: topicError } = await supabase
      .from("topics")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject", task.subject)
      .order("mastery_score", { ascending: true })
      .limit(1)

    if (topicError) {
      console.error(topicError)
      return
    }

    const weakestTopic = topics?.[0]

    if (!weakestTopic) return

    const newMastery = calculateNewMastery(
      weakestTopic.mastery_score,
      minutes
    )

    const { error: updateError } = await supabase
      .from("topics")
      .update({
        mastery_score: newMastery,
      })
      .eq("id", weakestTopic.id)
      .eq("user_id", user.id)

    if (updateError) {
      console.error(updateError)
    }
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60

    return `${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`
  }

  const currentTask = tasks.find(
    (task) => String(task.id) === selectedTask
  )

  const progress =
    minutes > 0
      ? ((minutes * 60 - secondsLeft) / (minutes * 60)) * 100
      : 0

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-medium text-blue-600">
            Focus Mode
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Deep Work Session
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Pick one task and focus only on that task.
          </p>
        </div>

        <div className="rounded-3xl bg-slate-950 p-8 text-white shadow-xl">
          <div className="mb-8">
            <label className="text-xs font-bold tracking-widest text-slate-400">
              CURRENT TASK
            </label>

            <select
              value={selectedTask}
              onChange={(e) => {
                setSelectedTask(e.target.value)
                setRunning(false)
                setCompleted(false)
              }}
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none shadow-sm"
            >
              {tasks.map((task) => (
                <option
                  key={task.id}
                  value={task.id}
                >
                  {task.title} ({task.subject})
                </option>
              ))}
            </select>
          </div>

          {currentTask && (
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <p className="text-base font-semibold">
                {currentTask.title}
              </p>

              <p className="mt-1 text-xs text-slate-300">
                {currentTask.subject} • Estimated: {currentTask.estimated_minutes || 30} mins
              </p>
            </div>
          )}

          <div className="text-center">
            <p className="text-7xl font-bold tracking-tight font-mono">
              {formatTime(secondsLeft)}
            </p>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            {[25, 45, 60].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeDuration(value)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  minutes === value
                    ? "bg-white text-slate-900 shadow-md"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {value} min
              </button>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-3">
            {!running ? (
              <button
                type="button"
                onClick={startSession}
                disabled={!selectedTask || completed}
                className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-50 transition shadow-md"
              >
                {completed ? "Session Completed ✓" : "Start Focus"}
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseSession}
                className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-950 hover:bg-slate-100 transition shadow-md"
              >
                Pause
              </button>
            )}

            <button
              type="button"
              onClick={resetSession}
              className="rounded-xl bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition"
            >
              Reset
            </button>
          </div>
        </div>

        {completed && (
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">🎯</p>

            <h2 className="mt-2 text-lg font-bold text-slate-900">
              Focus session completed!
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {minutes} minutes recorded for{" "}
              <span className="font-semibold text-slate-800">{currentTask?.title}</span>. Mastery score updated!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FocusSession
