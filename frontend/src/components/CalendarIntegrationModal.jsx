import { useEffect, useState } from "react"
import {
  fetchCalendarAuthUrl,
  fetchCalendarStatus,
  fetchCalendarEvents,
  disconnectCalendarService,
} from "../lib/api"
import { getMergedFreeWindows } from "../utils/freeTime"

export function CalendarIntegrationModal({
  isOpen,
  onClose,
  user,
  schedule = [],
  onCalendarUpdated = () => {},
}) {
  const [status, setStatus] = useState({ connected: false, email: null, last_synced: null })
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    if (isOpen && user?.id) {
      loadCalendarStatus()
    }
  }, [isOpen, user])

  async function loadCalendarStatus() {
    if (!user?.id) return
    setLoading(true)
    setError("")

    try {
      const res = await fetchCalendarStatus(user.id)
      setStatus(res)

      if (res.connected) {
        await loadEvents()
      }
    } catch (err) {
      console.warn("Calendar status notice:", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadEvents() {
    if (!user?.id) return
    setSyncing(true)
    setError("")

    try {
      const data = await fetchCalendarEvents(user.id)
      if (data.events) {
        setEvents(data.events)
        onCalendarUpdated(data.events)
      }
      if (data.last_synced) {
        setStatus((prev) => ({ ...prev, last_synced: data.last_synced }))
      }
    } catch (err) {
      setError("Could not synchronize calendar events.")
    } finally {
      setSyncing(false)
    }
  }

  async function handleConnect() {
    if (!user?.id) return
    setError("")
    setLoading(true)

    try {
      const res = await fetchCalendarAuthUrl(user.id)
      if (res.configured && res.auth_url) {
        // Redirect to Google OAuth Consent screen
        window.location.href = res.auth_url
      } else {
        setError(
          res.message ||
            "Google Calendar OAuth client credentials are not configured on the backend. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your backend environment variables."
        )
      }
    } catch (err) {
      setError(`OAuth initialization notice: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!user?.id) return
    if (!window.confirm("Disconnect Google Calendar? Your CoursePilot tasks and timetable will remain unaffected.")) {
      return
    }

    setLoading(true)
    setError("")
    setSuccessMsg("")

    try {
      await disconnectCalendarService(user.id)
      setStatus({ connected: false, email: null, last_synced: null })
      setEvents([])
      onCalendarUpdated([])
      setSuccessMsg("Google Calendar disconnected successfully.")
    } catch (err) {
      setError("Could not disconnect Google Calendar.")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const freeWindows = getMergedFreeWindows({
    schedule,
    calendarEvents: events,
    date: new Date(),
    dayStart: "08:00",
    dayEnd: "22:00",
  })

  const totalFreeMinutes = freeWindows.reduce((acc, curr) => acc + curr.minutes, 0)
  const freeHours = Math.floor(totalFreeMinutes / 60)
  const freeMins = totalFreeMinutes % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-base shadow-xs">
              📅
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Google Calendar Integration
              </h2>
              <p className="text-xs text-slate-500">
                Sync external events to discover real available study time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 border border-amber-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200">
            ✓ {successMsg}
          </div>
        )}

        {/* Connection Status Box */}
        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  status.connected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                }`}
              />
              <span className="text-xs font-bold text-slate-900">
                {status.connected ? "Connected to Google Calendar" : "Not Connected"}
              </span>
            </div>

            {status.connected && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                Active Sync
              </span>
            )}
          </div>

          {status.connected ? (
            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
              <p>
                <span className="text-slate-400">Account:</span>{" "}
                <strong className="font-semibold text-slate-800">{status.email}</strong>
              </p>
              <p>
                <span className="text-slate-400">Last Synced:</span>{" "}
                <span className="font-mono text-[11px]">
                  {status.last_synced ? new Date(status.last_synced).toLocaleTimeString() : "Just now"}
                </span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={loadEvents}
                  disabled={syncing}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 active:scale-[0.98]"
                >
                  {syncing ? "Syncing..." : "Sync Now ↻"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect your Google account with read-only calendar permissions. CoursePilot will merge your personal appointments with your university timetable to find open study slots.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm active:scale-[0.98]"
              >
                <span>Connect Google Calendar</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* Calculated Availability Summary */}
        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              TODAY&apos;S CALCULATED FREE STUDY TIME
            </p>
            <span className="text-xs font-bold text-blue-600">
              {freeHours > 0 ? `${freeHours}h ` : ""}{freeMins}m Available
            </span>
          </div>

          {freeWindows.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              No free windows $\ge 15$ mins available today.
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {freeWindows.map((win, idx) => (
                <span
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-700"
                >
                  {win.start} – {win.end} ({win.minutes}m)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default CalendarIntegrationModal
