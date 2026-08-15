export function buildDailyPlan({
  classes,
  tasks,
  exams,
  studyWindows,
  weakestTopic,
}) {
  const plan = []

  if (classes && Array.isArray(classes)) {
    classes.forEach((item) => {
      plan.push({
        type: "class",
        start: item.start_time?.slice(0, 5),
        end: item.end_time?.slice(0, 5),
        title:
          item.academic_subjects?.subject_name ||
          "Class",
        subtitle:
          `Room ${item.room || "—"} • ${item.teacher_name || "Faculty N/A"}`,
      })
    })
  }

  const sortedWindows = [...(studyWindows || [])].sort(
    (a, b) => a.start.localeCompare(b.start)
  )

  const pendingTasks = [...(tasks || [])]
    .filter((task) => task.status !== "completed")
    .sort((a, b) => {
      const importanceDiff =
        Number(b.importance || 0) -
        Number(a.importance || 0)

      if (importanceDiff !== 0) {
        return importanceDiff
      }

      return new Date(a.deadline) - new Date(b.deadline)
    })

  sortedWindows.forEach((window, index) => {
    const task = pendingTasks[index]

    if (!task) {
      plan.push({
        type: "study",
        start: window.start,
        end: window.end,
        title: "Open Study Window",
        subtitle: `${window.minutes} minutes available for revision`,
      })

      return
    }

    plan.push({
      type: "study",
      start: window.start,
      end: window.end,
      title: `Study: ${task.title}`,
      subtitle: `${task.subject} · ${Math.min(
        Number(task.estimated_minutes || 30),
        window.minutes
      )} min task`,
    })
  })

  // Sort timed items (classes and study slots) chronologically by start time
  const timedItems = plan.filter((p) => p.start).sort((a, b) => a.start.localeCompare(b.start))
  const untimedItems = []

  if (exams && exams.length > 0) {
    const closestExam = [...exams].sort(
      (a, b) =>
        new Date(a.exam_date) -
        new Date(b.exam_date)
    )[0]

    untimedItems.push({
      type: "exam",
      title: `Upcoming: ${closestExam.subject} Exam`,
      subtitle: `Exam date: ${new Date(closestExam.exam_date).toLocaleDateString()} · Importance ${closestExam.importance}/10`,
    })
  }

  if (weakestTopic) {
    untimedItems.push({
      type: "weakness",
      title: `Weak Topic Focus: ${weakestTopic.topic_name}`,
      subtitle: `${weakestTopic.subject} · Current Mastery ${weakestTopic.mastery_score}%`,
    })
  }

  return [...timedItems, ...untimedItems]
}
