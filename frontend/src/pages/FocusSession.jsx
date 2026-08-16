import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { calculateNewMastery } from "../utils/mastery"

function FocusSession({ user, recommendedTaskId, onReturnToDashboard }) {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState("")
  const [minutes, setMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [endTime, setEndTime] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [updatingTask, setUpdatingTask] = useState(false)

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
      if (endTime) {
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000))
        setSecondsLeft(remaining)
        if (remaining === 0) {
          finishSession()
        }
      } else {
        setSecondsLeft((prev) => Math.max(0, prev - 1))
      }
    }, 1000)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && running && endTime) {
        const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000))
        setSecondsLeft(remaining)
        if (remaining === 0) {
          finishSession()
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [running, secondsLeft, endTime])

  async function loadTasks() {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, subject, deadline, estimated_minutes")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("deadline", { ascending: true })

      if (error) throw error

      const fetched = data || []
      setTasks(fetched)

      if (fetched.length > 0) {
        const recommendedExists = fetched.some(
          (t) => String(t.id) === String(recommendedTaskId)
        )
        if (recommendedTaskId && recommendedExists) {
          setSelectedTask(String(recommendedTaskId))
        } else {
          setSelectedTask(String(fetched[0].id))
        }
      }
    } catch (err) {
      console.error("Task load error:", err)
    }
  }

  function changeDuration(val) {
    setMinutes(val)
    setSecondsLeft(val * 60)
    setEndTime(null)
    setRunning(false)
    setCompleted(false)
  }

  function startSession() {
    if (!selectedTask) return
    const targetEnd = Date.now() + minutes * 60 * 1000
    setEndTime(targetEnd)
    setCompleted(false)
    setSecondsLeft(minutes * 60)
    setRunning(true)
  }

  function pauseSession() {
    setRunning(false)
    setEndTime(null)
  }

  function resetSession() {
    setRunning(false)
    setEndTime(null)
    setSecondsLeft(minutes * 60)
    setCompleted(false)
  }

  async function finishSession() {
    setRunning(false)
    setEndTime(null)
    setCompleted(true)

    if (!user?.id) return

    try {
      await supabase.from("study_sessions").insert([
        {
          user_id: user.id,
          task_id: Number(selectedTask),
          duration_minutes: minutes,
          completed: true,
        },
      ])

      const task = tasks.find((t) => String(t.id) === selectedTask)
      if (!task) return

      try {
        const { data: stProgress } = await supabase
          .from("student_topic_progress")
          .select("id, mastery_score")
          .eq("user_id", user.id)
          .order("mastery_score", { ascending: true })
          .limit(1)

        const weakest = stProgress?.[0]
        if (weakest) {
          const newMastery = calculateNewMastery(weakest.mastery_score, minutes)
          await supabase
            .from("student_topic_progress")
            .update({
              mastery_score: newMastery,
              status: newMastery >= 80 ? "mastered" : newMastery >= 40 ? "in_progress" : "needs_revision",
              updated_at: new Date().toISOString(),
            })
            .eq("id", weakest.id)
        }
      } catch (stErr) {
        console.warn("Topic progress mastery update note:", stErr)
      }
    } catch (err) {
      console.error("Session finish note:", err)
    }
  }

  async function completeTaskAndReturn() {
    if (!selectedTask || !user?.id) {
      if (onReturnToDashboard) onReturnToDashboard()
      return
    }

    setUpdatingTask(true)

    try {
      await supabase
        .from("tasks")
        .update({ status: "completed" })
        .eq("id", Number(selectedTask))
        .eq("user_id", user.id)

      if (onReturnToDashboard) {
        onReturnToDashboard()
      }
    } catch (err) {
      console.error("Complete task error:", err)
      if (onReturnToDashboard) onReturnToDashboard()
    } finally {
      setUpdatingTask(false)
    }
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const currentTask = tasks.find((t) => String(t.id) === selectedTask)
  const progress =
    minutes > 0 ? ((minutes * 60 - secondsLeft) / (minutes * 60)) * 100 : 0

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-blue-600 uppercase">
              DISTRACTION-FREE WORK
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Deep Work Focus Session
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Select one task, mute interruptions, and lock in your study momentum.
            </p>
          </div>

          {onReturnToDashboard && (
            <button
              type="button"
              onClick={onReturnToDashboard}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              ← Dashboard
            </button>
          )}
        </div>

        {/* Timer Card */}
        <div className="rounded-3xl bg-slate-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="mb-6">
            <label className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
              SELECT TASK TO FOCUS ON
            </label>

            {tasks.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                No pending tasks found. Add a task in the Tasks tab to link focus sessions.
              </p>
            ) : (
              <select
                value={selectedTask}
                onChange={(e) => {
                  setSelectedTask(e.target.value)
                  setRunning(false)
                  setEndTime(null)
                  setCompleted(false)
                }}
                className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 outline-none shadow-sm"
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.subject})
                  </option>
                ))}
              </select>
            )}
          </div>

          {currentTask && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="text-sm sm:text-base font-bold text-white">
                {currentTask.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {currentTask.subject} · Target: {currentTask.estimated_minutes || 30} mins
              </p>
            </div>
          )}

          {/* Time Display */}
          <div className="my-8 text-center">
            <p className="font-mono text-6xl sm:text-7xl font-extrabold tracking-tight text-white">
              {formatTime(secondsLeft)}
            </p>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Duration Selector */}
          <div className="mt-6 flex justify-center gap-2.5">
            {[25, 45, 60].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => changeDuration(val)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] ${
                  minutes === val
                    ? "bg-white text-slate-950 shadow-md"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {val} min
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="mt-6 flex justify-center gap-3">
            {!running ? (
              <button
                type="button"
                onClick={startSession}
                disabled={!selectedTask || completed}
                className="rounded-xl bg-white px-7 py-3 text-xs sm:text-sm font-bold text-slate-950 hover:bg-slate-100 disabled:opacity-50 transition shadow-md active:scale-[0.98]"
              >
                {completed ? "Session Completed ✓" : "Start Focus Session"}
              </button>
            ) : (
              <button
                type="button"
                onClick={pauseSession}
                className="rounded-xl bg-white px-7 py-3 text-xs sm:text-sm font-bold text-slate-950 hover:bg-slate-100 transition shadow-md active:scale-[0.98]"
              >
                Pause
              </button>
            )}

            <button
              type="button"
              onClick={resetSession}
              className="rounded-xl bg-white/10 px-5 py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/20 transition active:scale-[0.98]"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Post-Session Action Cards */}
        {completed && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
            <span className="text-3xl">🎯</span>
            <h2 className="mt-2 text-base font-bold text-emerald-950">
              Focus session completed!
            </h2>
            <p className="mt-1 text-xs text-emerald-800">
              {minutes} minutes recorded for{" "}
              <strong className="font-bold">{currentTask?.title}</strong>. Your mastery progression has been updated!
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={completeTaskAndReturn}
                disabled={updatingTask}
                className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-sm active:scale-[0.98]"
              >
                {updatingTask ? "Completing..." : "✓ Mark Task Done & Return to Dashboard"}
              </button>

              {onReturnToDashboard && (
                <button
                  type="button"
                  onClick={onReturnToDashboard}
                  className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/50 transition"
                >
                  Return to Dashboard →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default FocusSession
