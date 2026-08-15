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
        start: item.start_time?.slice(0, 5) || "09:00",
        end: item.end_time?.slice(0, 5) || "10:00",
        title:
          item.academic_subjects?.subject_name ||
          "Class",
        subtitle:
          `Room ${item.room || "—"} • ${item.teacher_name || "Faculty N/A"}`,
      })
    })
  }

  const sortedWindows = [...(studyWindows || [])].sort(
    (a, b) => (a.start || "").localeCompare(b.start || "")
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

      const aTime = a.deadline ? new Date(a.deadline).getTime() : 0
      const bTime = b.deadline ? new Date(b.deadline).getTime() : 0
      return aTime - bTime
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

  // Sort timed items chronologically
  const timedItems = plan.filter((p) => p.start).sort((a, b) => (a.start || "").localeCompare(b.start || ""))
  const untimedItems = []

  if (exams && exams.length > 0) {
    const closestExam = [...exams].sort(
      (a, b) => {
        const aTime = a.exam_date ? new Date(a.exam_date).getTime() : 0
        const bTime = b.exam_date ? new Date(b.exam_date).getTime() : 0
        return aTime - bTime
      }
    )[0]

    if (closestExam) {
      untimedItems.push({
        type: "exam",
        title: `Upcoming: ${closestExam.subject} Exam`,
        subtitle: `Exam date: ${new Date(closestExam.exam_date).toLocaleDateString()} · Importance ${closestExam.importance || 5}/10`,
      })
    }
  }

  if (weakestTopic) {
    untimedItems.push({
      type: "weakness",
      title: `Weak Topic Focus: ${weakestTopic.topic_name}`,
      subtitle: `${weakestTopic.subject_name || weakestTopic.subject || "Syllabus"} · Current Mastery ${weakestTopic.mastery_score || 0}%`,
    })
  }

  return [...timedItems, ...untimedItems]
}
