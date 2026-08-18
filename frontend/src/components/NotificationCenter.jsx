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
        className="fixed inset-0 bg-[#18181B]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border border-[#E4E4E7] bg-white shadow-2xl transition-all dark:border-[#27343a] dark:bg-[#141c1f]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] p-5 sm:p-6 pb-4 dark:border-[#27343a]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#0F766E] text-base shadow-2xs dark:bg-[#182226] dark:text-[#2DD4BF]">
              🔔
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  Notification Center
                </h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#0F766E] px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-[#52525B] dark:text-[#a1a1aa]">
                High-priority academic milestones and study alerts.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#71717A] hover:bg-[#F7F7F2] hover:text-[#18181B] transition dark:hover:bg-[#182226] dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#E4E4E7] px-5 sm:px-6 dark:border-[#27343a]">
          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition ${
              activeTab === "feed"
                ? "border-[#0F766E] text-[#0F766E] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                : "border-transparent text-[#71717A] hover:text-[#18181B] dark:text-[#71717a] dark:hover:text-[#f4f4f5]"
            }`}
          >
            Notifications ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`border-b-2 py-2.5 px-4 text-xs font-bold transition ${
              activeTab === "settings"
                ? "border-[#0F766E] text-[#0F766E] dark:border-[#2DD4BF] dark:text-[#2DD4BF]"
                : "border-transparent text-[#71717A] hover:text-[#18181B] dark:text-[#71717a] dark:hover:text-[#f4f4f5]"
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
                    className="text-xs font-semibold text-[#0F766E] hover:text-[#115E59] transition dark:text-[#2DD4BF]"
                  >
                    ✓ Mark all as read
                  </button>
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-xs font-semibold text-[#71717A] hover:text-[#DC2626] transition dark:text-[#a1a1aa]"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-4xl">✨</span>
                  <p className="mt-3 text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">
                    All caught up!
                  </p>
                  <p className="mt-1 text-xs text-[#52525B] max-w-xs mx-auto dark:text-[#a1a1aa]">
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
                          ? "border-[#0F766E]/40 bg-[#ECFDF5]/40 shadow-2xs dark:border-[#2DD4BF]/40 dark:bg-[#182226]"
                          : "border-[#E4E4E7] bg-white hover:bg-[#F7F7F2] dark:border-[#27343a] dark:bg-[#141c1f] dark:hover:bg-[#182226]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${
                              item.priority === "CRITICAL"
                                ? "bg-rose-50 text-[#DC2626] border border-rose-200/60"
                                : item.priority === "HIGH"
                                  ? "bg-amber-50 text-[#D97706] border border-amber-200/60"
                                  : "bg-[#ECFDF5] text-[#0F766E] border border-teal-200/60"
                            }`}
                          >
                            {item.priority}
                          </span>
                          {!item.is_read && (
                            <span className="h-2 w-2 rounded-full bg-[#0F766E] dark:bg-[#2DD4BF]" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#71717A] font-mono dark:text-[#a1a1aa]">
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
                            className="text-[#71717A] hover:text-[#DC2626] rounded-full p-0.5 text-xs transition"
                            title="Dismiss notification"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <h4 className="mt-2 text-xs sm:text-sm font-bold text-[#18181B] dark:text-[#f4f4f5]">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-[#52525B] leading-relaxed dark:text-[#a1a1aa]">
                        {item.message}
                      </p>

                      {item.target_page && (
                        <p className="mt-2.5 text-[11px] font-bold text-[#0F766E] dark:text-[#2DD4BF]">
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
              <div className="rounded-2xl border border-[#E4E4E7] bg-[#F7F7F2] p-4 dark:border-[#27343a] dark:bg-[#182226]">
                <p className="text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                  Browser Push Notifications
                </p>
                <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#a1a1aa]">
                  Receive alerts when deadlines are imminent or study sessions start.
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#52525B] dark:text-[#a1a1aa]">
                    Status:{" "}
                    <strong
                      className={`capitalize ${
                        permissionStatus === "granted"
                          ? "text-[#15803D] dark:text-[#2DD4BF]"
                          : permissionStatus === "denied"
                            ? "text-[#DC2626]"
                            : "text-[#52525B]"
                      }`}
                    >
                      {permissionStatus}
                    </strong>
                  </span>

                  {permissionStatus !== "granted" && (
                    <button
                      type="button"
                      onClick={handleRequestPermission}
                      className="rounded-xl bg-[#0F766E] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#115E59] shadow-2xs transition"
                    >
                      Enable Push
                    </button>
                  )}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold tracking-widest text-[#71717A] uppercase dark:text-[#a1a1aa]">
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
                    className="flex items-start justify-between gap-3 rounded-xl border border-[#E4E4E7] p-3 hover:bg-[#F7F7F2] transition cursor-pointer dark:border-[#27343a] dark:hover:bg-[#182226]"
                  >
                    <div>
                      <p className="text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[#52525B] dark:text-[#a1a1aa]">{item.desc}</p>
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
                      className="h-4 w-4 rounded accent-[#0F766E] mt-1"
                    />
                  </label>
                ))}
              </div>

              {/* Quiet Hours */}
              <div className="rounded-2xl border border-[#E4E4E7] p-4 dark:border-[#27343a]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[#18181B] dark:text-[#f4f4f5]">
                      Quiet Hours
                    </p>
                    <p className="text-[11px] text-[#52525B] dark:text-[#a1a1aa]">
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
                    className="h-4 w-4 rounded accent-[#0F766E]"
                  />
                </div>

                {preferences.quiet_hours_enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E4E4E7] pt-3 dark:border-[#27343a]">
                    <div>
                      <label className="text-[10px] font-bold text-[#71717A] uppercase dark:text-[#a1a1aa]">
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
                        className="mt-1 w-full rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-xs font-semibold bg-white text-[#18181B] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#71717A] uppercase dark:text-[#a1a1aa]">
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
                        className="mt-1 w-full rounded-lg border border-[#E4E4E7] px-2.5 py-1.5 text-xs font-semibold bg-white text-[#18181B] dark:bg-[#182226] dark:border-[#27343a] dark:text-[#f4f4f5]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E4E4E7] p-4 px-6 flex justify-end dark:border-[#27343a]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E4E4E7] bg-white px-5 py-2 text-xs font-bold text-[#18181B] hover:bg-[#F7F7F2] transition shadow-2xs dark:border-[#27343a] dark:bg-[#141c1f] dark:text-[#f4f4f5] dark:hover:bg-[#182226]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationCenter
