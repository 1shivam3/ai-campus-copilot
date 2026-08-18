/**
 * CoursePilot Smart Notification Engine
 *
 * Generates deterministic, high-value academic notifications with
 * strict duplicate prevention, priority categorization, and quiet-hours filtering.
 */

export const NOTIFICATION_TYPES = {
  URGENT_ASSIGNMENT: "URGENT_ASSIGNMENT",
  UPCOMING_EXAM: "UPCOMING_EXAM",
  WEAK_TOPIC: "WEAK_TOPIC",
  STUDY_REMINDER: "STUDY_REMINDER",
  MISSED_STUDY_PLAN: "MISSED_STUDY_PLAN",
  PROGRESS: "PROGRESS",
}

export const NOTIFICATION_PRIORITIES = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  NORMAL: "NORMAL",
  LOW: "LOW",
}

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  assignment_reminders: true,
  exam_reminders: true,
  study_reminders: true,
  weak_topic_reminders: true,
  progress_reminders: true,
  quiet_hours_enabled: true,
  quiet_hours_start: "22:30",
  quiet_hours_end: "07:00",
}

export function isTimeInQuietHours(
  now = new Date(),
  startStr = "22:30",
  endStr = "07:00"
) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [sH, sM] = startStr.split(":").map(Number)
  const [eH, eM] = endStr.split(":").map(Number)

  const startMins = sH * 60 + (sM || 0)
  const endMins = eH * 60 + (eM || 0)

  if (startMins > endMins) {
    // Spans midnight (e.g. 22:30 -> 07:00)
    return currentMinutes >= startMins || currentMinutes < endMins
  }

  return currentMinutes >= startMins && currentMinutes < endMins
}

export function generateSmartNotifications({
  tasks = [],
  exams = [],
  syllabusTopics = [],
  topicProgress = {},
  studyWindows = [],
  bestAction = null,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys = new Set(),
  now = new Date(),
}) {
  if (!preferences.enabled) {
    return []
  }

  const notifications = []
  const todayStr = now.toISOString().slice(0, 10)

  // 1. Evaluate Urgent Assignments (max 1 urgent alert per day)
  if (preferences.assignment_reminders && Array.isArray(tasks)) {
    for (const task of tasks) {
      if (task.status === "completed" || !task.deadline) continue

      const diffMs = new Date(task.deadline).getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      if (diffHours > 0 && diffHours <= 2) {
        // Critical: due in <= 2 hours
        const dedupKey = `urgent_task_${task.id}_${todayStr}`
        if (!deliveredKeys.has(dedupKey)) {
          notifications.push({
            id: `notif_${dedupKey}`,
            dedup_key: dedupKey,
            type: NOTIFICATION_TYPES.URGENT_ASSIGNMENT,
            priority: NOTIFICATION_PRIORITIES.CRITICAL,
            title: `Urgent: ${task.title}`,
            message: `${task.title} (${task.subject || "Task"}) is due in less than 2 hours.`,
            related_entity_type: "task",
            related_entity_id: task.id,
            target_page: "Tasks",
            is_read: false,
            created_at: now.toISOString(),
          })
          break // Limit to 1 urgent task notification at a time
        }
      } else if (diffHours > 2 && diffHours <= 24) {
        // High: due in <= 24 hours
        const dedupKey = `urgent_task_${task.id}_${todayStr}`
        if (!deliveredKeys.has(dedupKey)) {
          notifications.push({
            id: `notif_${dedupKey}`,
            dedup_key: dedupKey,
            type: NOTIFICATION_TYPES.URGENT_ASSIGNMENT,
            priority: NOTIFICATION_PRIORITIES.HIGH,
            title: `Assignment Due Tomorrow`,
            message: `${task.title} (${task.subject || "Task"}) is due in ${Math.round(diffHours)} hours.`,
            related_entity_type: "task",
            related_entity_id: task.id,
            target_page: "Tasks",
            is_read: false,
            created_at: now.toISOString(),
          })
          break // Limit to 1 urgent task notification at a time
        }
      }
    }
  }

  // 2. Evaluate Upcoming Exams (7 days, 3 days, 1 day) - max 1 per run
  if (preferences.exam_reminders && Array.isArray(exams) && notifications.length < 2) {
    for (const exam of exams) {
      if (!exam.exam_date) continue

      const diffMs = new Date(exam.exam_date).getTime() - now.getTime()
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      if ([1, 3, 7].includes(days)) {
        const dedupKey = `exam_${exam.id}_${days}d_${todayStr}`
        if (!deliveredKeys.has(dedupKey)) {
          const priority =
            days === 1
              ? NOTIFICATION_PRIORITIES.CRITICAL
              : days === 3
                ? NOTIFICATION_PRIORITIES.HIGH
                : NOTIFICATION_PRIORITIES.NORMAL

          notifications.push({
            id: `notif_${dedupKey}`,
            dedup_key: dedupKey,
            type: NOTIFICATION_TYPES.UPCOMING_EXAM,
            priority,
            title: `Upcoming Exam: ${exam.subject}`,
            message: `Your ${exam.subject} exam is in ${days} day${days > 1 ? "s" : ""}. Prepare high-yield topics now.`,
            related_entity_type: "exam",
            related_entity_id: exam.id,
            target_page: "Exam Mode",
            is_read: false,
            created_at: now.toISOString(),
          })
          break // Max 1 exam reminder per run
        }
      }
    }
  }

  // 3. Evaluate Weak Topics for Proximity Exams (<= 5 days) - max 1 per day
  if (preferences.weak_topic_reminders && Array.isArray(exams) && Array.isArray(syllabusTopics) && notifications.length < 2) {
    const upcomingSoonExams = exams.filter((e) => {
      const days = Math.ceil((new Date(e.exam_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days > 0 && days <= 5
    })

    for (const exam of upcomingSoonExams) {
      const examSubj = (exam.subject || "").toLowerCase()
      const subjectTopics = syllabusTopics.filter(
        (t) => {
          const tSubj = (t.academic_subjects?.subject_name || "").toLowerCase()
          return (tSubj && examSubj && tSubj.includes(examSubj)) || (examSubj && tSubj && examSubj.includes(tSubj))
        }
      )

      if (subjectTopics.length > 0) {
        // Find weakest topic
        const sortedWeak = [...subjectTopics].sort((a, b) => {
          const scoreA = topicProgress[a.id]?.mastery_score ?? 0
          const scoreB = topicProgress[b.id]?.mastery_score ?? 0
          return scoreA - scoreB
        })

        const weakest = sortedWeak[0]
        const score = topicProgress[weakest?.id]?.mastery_score ?? 0

        if (weakest && score < 50) {
          const dedupKey = `weak_topic_${weakest.id}_${todayStr}`
          if (!deliveredKeys.has(dedupKey)) {
            notifications.push({
              id: `notif_${dedupKey}`,
              dedup_key: dedupKey,
              type: NOTIFICATION_TYPES.WEAK_TOPIC,
              priority: NOTIFICATION_PRIORITIES.HIGH,
              title: `High-Risk Topic: ${weakest.topic_name || weakest.title || "Topic"}`,
              message: `${weakest.topic_name || weakest.title || "Topic"} has only ${score}% mastery before your ${exam.subject} exam.`,
              related_entity_type: "topic",
              related_entity_id: weakest.id,
              target_page: "Exam Mode",
              is_read: false,
              created_at: now.toISOString(),
            })
            break // Max 1 weak topic reminder per day
          }
        }
      }
    }
  }

  // 4. Evaluate Calendar / Timetable Study Window Reminders - strictly max 1 per day
  if (preferences.study_reminders && Array.isArray(studyWindows) && studyWindows.length > 0 && bestAction && notifications.length < 2) {
    const primaryWindow = studyWindows[0]
    if (primaryWindow && primaryWindow.minutes >= 30) {
      // Deterministic once-per-day key for study window reminders
      const dedupKey = `study_reminder_${todayStr}`
      if (!deliveredKeys.has(dedupKey)) {
        notifications.push({
          id: `notif_${dedupKey}`,
          dedup_key: dedupKey,
          type: NOTIFICATION_TYPES.STUDY_REMINDER,
          priority: NOTIFICATION_PRIORITIES.NORMAL,
          title: `Study Opportunity: ${primaryWindow.start} – ${primaryWindow.end}`,
          message: `You have ${primaryWindow.minutes} mins free. Recommended focus: ${bestAction.title || "Academic Review"}.`,
          related_entity_type: "study_window",
          related_entity_id: primaryWindow.start,
          target_page: "Exam Mode",
          is_read: false,
          created_at: now.toISOString(),
        })
      }
    }
  }

  // Strictly limit return batch to 1 or 2 high-value notifications
  return notifications.slice(0, 2)
}
