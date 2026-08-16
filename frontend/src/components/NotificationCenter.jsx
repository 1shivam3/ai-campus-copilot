import { useState } from "react"
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "../lib/notifications"

export function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
  onMarkAsRead = () => {},
  onMarkAllAsRead = () => {},
  onClearAll = () => {},
  onDismiss = () => {},
  onNavigate = () => {},
  preferences,
  onUpdatePreferences = () => {},
}) {
  const [activeTab, setActiveTab] = useState("feed") // "feed" | "settings"
  const [permissionStatus, setPermissionStatus] = useState(
    getBrowserNotificationPermission()
  )

  if (!isOpen) return null

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleRequestPermission() {
    const result = await requestBrowserNotificationPermission()
    setPermissionStatus(result)
  }

  function handleItemClick(notif) {
    onMarkAsRead(notif.id)
    if (notif.target_page) {
      onNavigate(notif.target_page, notif.related_entity_id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-slate-200/80 bg-white shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-base shadow-xs">
              🔔
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Notification Center
                </h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                High-priority academic milestones and study alerts.
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

        {/* Tab Controls */}
        <div className="flex border-b border-slate-100 px-5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition ${
              activeTab === "feed"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            Notifications ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition ${
              activeTab === "settings"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            Preferences ⚙️
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === "feed" ? (
            <div>
              {/* Actions Bar */}
              {notifications.length > 0 && (
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    ✓ Mark all as read
                  </button>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-xs font-semibold text-slate-400 hover:text-red-600 transition"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-4xl">✨</span>
                  <p className="mt-3 text-sm font-bold text-slate-800">
                    All caught up!
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                    CoursePilot will alert you when upcoming deadlines, exam risks, or free study windows require attention.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`cursor-pointer rounded-2xl border p-4 transition active:scale-[0.99] ${
                        !item.is_read
                          ? "border-blue-200 bg-blue-50/40 shadow-xs"
                          : "border-slate-200/80 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${
                              item.priority === "CRITICAL"
                                ? "bg-red-100 text-red-700"
                                : item.priority === "HIGH"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {item.priority}
                          </span>
                          {!item.is_read && (
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDismiss(item.id)
                            }}
                            className="text-slate-300 hover:text-slate-600 rounded-full p-0.5 text-xs transition"
                            title="Dismiss notification"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <h4 className="mt-2 text-xs sm:text-sm font-bold text-slate-900">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                        {item.message}
                      </p>

                      {item.target_page && (
                        <p className="mt-2.5 text-[11px] font-bold text-blue-600">
                          Open in {item.target_page} →
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Browser Push Permission Banner */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-xs font-bold text-slate-900">
                  Browser Push Notifications
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Receive alerts when deadlines are imminent or study sessions start.
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Status:{" "}
                    <strong
                      className={`capitalize ${
                        permissionStatus === "granted"
                          ? "text-emerald-600"
                          : permissionStatus === "denied"
                            ? "text-red-600"
                            : "text-slate-600"
                      }`}
                    >
                      {permissionStatus}
                    </strong>
                  </span>

                  {permissionStatus !== "granted" && (
                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                    >
                      Enable Push
                    </button>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  ALERT PREFERENCES
                </p>

                {[
                  {
                    key: "assignment_reminders",
                    label: "Urgent Assignment Deadlines",
                    desc: "Notify when homework is due within 24 hours.",
                  },
                  {
                    key: "exam_reminders",
                    label: "Upcoming Exam Milestones",
                    desc: "Remind 7 days, 3 days, and 1 day before exams.",
                  },
                  {
                    key: "weak_topic_reminders",
                    label: "Weak Topic Alerts",
                    desc: "Highlight high-risk syllabus units before tests.",
                  },
                  {
                    key: "study_reminders",
                    label: "Available Study Windows",
                    desc: "Alert when timetable or calendar free slots open.",
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(preferences[item.key])}
                      onChange={(e) =>
                        onUpdatePreferences({
                          ...preferences,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 mt-1"
                    />
                  </label>
                ))}
              </div>

              {/* Quiet Hours */}
              <div className="rounded-2xl border border-slate-200/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Quiet Hours
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Mute non-critical alerts during sleep/rest hours.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(preferences.quiet_hours_enabled)}
                    onChange={(e) =>
                      onUpdatePreferences({
                        ...preferences,
                        quiet_hours_enabled: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {preferences.quiet_hours_enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Quiet Starts
                      </label>
                      <input
                        type="time"
                        value={preferences.quiet_hours_start || "22:30"}
                        onChange={(e) =>
                          onUpdatePreferences({
                            ...preferences,
                            quiet_hours_start: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">
                        Quiet Ends
                      </label>
                      <input
                        type="time"
                        value={preferences.quiet_hours_end || "07:00"}
                        onChange={(e) =>
                          onUpdatePreferences({
                            ...preferences,
                            quiet_hours_end: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 px-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationCenter
