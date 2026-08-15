export function getDaysRemaining(date) {
  if (!date) return 0
  const difference =
    new Date(date).getTime() - Date.now()

  return Math.max(
    0,
    Math.ceil(
      difference / (1000 * 60 * 60 * 24)
    )
  )
}

export function getMinutesNow() {
  const now = new Date()

  return (
    now.getHours() * 60 +
    now.getMinutes()
  )
}

function timeToMinutes(time) {
  if (!time) return 0

  const [hours, minutes] = time
    .split(":")
    .map(Number)

  return hours * 60 + minutes
}

export function isCurrentlyInClass(schedule) {
  if (!schedule?.length) return false

  const today = new Date().toLocaleDateString(
    "en-US",
    { weekday: "long" }
  )

  const now = getMinutesNow()

  return schedule.some((item) => {
    if (item.day_of_week !== today) {
      return false
    }

    const start = timeToMinutes(item.start_time)
    const end = timeToMinutes(item.end_time)

    return now >= start && now < end
  })
}

export function getNextBestAction({
  tasks = [],
  exams = [],
  weakTopics = [],
  schedule = [],
  studyWindow = null,
}) {
  /*
   * 1. If the student is currently in class,
   * do not recommend a study action.
   */
  if (isCurrentlyInClass(schedule)) {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const now = getMinutesNow()
    const currentClass = schedule.find(
      (item) =>
        item.day_of_week === today &&
        now >= timeToMinutes(item.start_time) &&
        now < timeToMinutes(item.end_time)
    )

    return {
      type: "class",
      score: 10,
      title: currentClass?.academic_subjects?.subject_name
        ? `Attend ${currentClass.academic_subjects.subject_name}`
        : "Attend your current class",
      reason: `You are currently in scheduled class until ${currentClass?.end_time?.slice(0, 5) || "end of period"}.`,
      item: currentClass,
    }
  }

  /*
   * 2. Find the nearest important exam.
   */
  const closestExam = [...exams]
    .sort(
      (a, b) =>
        new Date(a.exam_date) -
        new Date(b.exam_date)
    )[0]

  /*
   * 3. Find highest-risk topic.
   */
  const weakestTopic = [...weakTopics]
    .sort(
      (a, b) =>
        Number(a.mastery_score || 0) -
        Number(b.mastery_score || 0)
    )[0]

  /*
   * 4. Find most important pending task.
   */
  const pendingTasks = tasks
    .filter(
      (task) =>
        task.status !== "completed"
    )
    .sort((a, b) => {
      const importanceDiff =
        Number(b.importance || 0) -
        Number(a.importance || 0)

      if (importanceDiff !== 0) {
        return importanceDiff
      }

      return (
        new Date(a.deadline) -
        new Date(b.deadline)
      )
    })

  const topTask = pendingTasks[0]

  /*
   * 5. Exam-critical recommendation.
   */
  if (closestExam) {
    const days =
      getDaysRemaining(
        closestExam.exam_date
      )

    if (
      days <= 3 &&
      weakestTopic &&
      Number(
        weakestTopic.mastery_score || 0
      ) < 60
    ) {
      return {
        type: "topic",
        score: 10,
        title:
          `Revise ${weakestTopic.topic_name}`,
        reason:
          `${closestExam.subject} exam is ${days} day${
            days === 1 ? "" : "s"
          } away and ${weakestTopic.topic_name} is currently your highest-risk topic (${weakestTopic.mastery_score}% mastery).`,
        item: weakestTopic,
      }
    }
  }

  /*
   * 6. Urgent task.
   */
  if (topTask) {
    const hoursRemaining =
      (
        new Date(topTask.deadline).getTime() -
        Date.now()
      ) /
      (1000 * 60 * 60)

    if (
      hoursRemaining <= 24 ||
      Number(topTask.importance || 0) >= 9
    ) {
      return {
        type: "task",
        score: 9,
        title: topTask.title,
        reason:
          "This task is highly important or approaching its imminent deadline.",
        item: topTask,
      }
    }
  }

  /*
   * 7. Use the study window when available.
   */
  if (
    studyWindow &&
    weakestTopic
  ) {
    return {
      type: "topic",
      score: 8,
      title:
        `Work on ${weakestTopic.topic_name}`,
      reason:
        `You have a ${studyWindow.minutes}-minute study window (${studyWindow.start} - ${studyWindow.end}) and this is your weakest recorded topic (${weakestTopic.mastery_score}%).`,
      item: weakestTopic,
    }
  }

  /*
   * 8. Normal task recommendation.
   */
  if (topTask) {
    return {
      type: "task",
      score: 7,
      title: topTask.title,
      reason:
        "This is currently your highest-priority pending task.",
      item: topTask,
    }
  }

  /*
   * 9. Fallback.
   */
  return {
    type: "general",
    score: 4,
    title: "Review your academic progress",
    reason:
      "There is no urgent academic action right now. Review course progress or take a practice quiz.",
    item: null,
  }
}
