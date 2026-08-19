/**
 * Next Best Action Decision Engine
 *
 * Pipeline:
 * Student Data -> Candidate Actions -> Priority Scoring -> Conflict / Hard Rules -> Best Action + Explanations
 */

function timeToMinutes(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

export function getMinutesNow() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function getDaysRemaining(date) {
  if (!date) return 999
  const difference = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.ceil(difference / (1000 * 60 * 60 * 24)))
}

export function getHoursRemaining(date) {
  if (!date) return 9999
  const diffMs = new Date(date).getTime() - Date.now()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)))
}

/**
 * 95A: Collect and normalize context
 */
export function buildAcademicContext({
  profile,
  schedule = [],
  tasks = [],
  exams = [],
  syllabusTopics = [],
  topicProgress = {},
  studyWindow = null,
}) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
  const nowMinutes = getMinutesNow()

  // 1. Today's classes
  const todayClasses = schedule
    .filter((item) => item.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Find active class or class starting within 30 minutes
  let activeClass = null
  let upcomingSoonClass = null

  for (const c of todayClasses) {
    const start = timeToMinutes(c.start_time)
    const end = timeToMinutes(c.end_time)

    if (nowMinutes >= start && nowMinutes < end) {
      activeClass = c
      break
    }

    if (start > nowMinutes && start - nowMinutes <= 30) {
      upcomingSoonClass = c
      break
    }
  }

  // 2. Pending Tasks
  const pendingTasks = tasks
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      const aHours = getHoursRemaining(a.deadline)
      const bHours = getHoursRemaining(b.deadline)
      if (aHours !== bHours) return aHours - bHours
      return Number(b.importance || 5) - Number(a.importance || 5)
    })

  // 3. Upcoming Exams
  const upcomingExams = exams
    .filter((e) => new Date(e.exam_date).getTime() >= Date.now() - 1000 * 60 * 60 * 24)
    .sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date))

  // 4. Syllabus topics with progress
  const topicsWithMastery = syllabusTopics.map((t) => ({
    ...t,
    mastery_score: Number(topicProgress[t.id]?.mastery_score || 0),
    status: topicProgress[t.id]?.status || "not_started",
  }))

  const weakestTopics = [...topicsWithMastery].sort(
    (a, b) => a.mastery_score - b.mastery_score
  )

  return {
    profile,
    today,
    nowMinutes,
    todayClasses,
    activeClass,
    upcomingSoonClass,
    pendingTasks,
    upcomingExams,
    topicsWithMastery,
    weakestTopics,
    studyWindow,
  }
}

/**
 * 95B: Generate Candidate Actions
 */
export function generateCandidateActions(context) {
  const candidates = []

  // 1. Timetable Actions
  if (context.activeClass) {
    const subName = context.activeClass.academic_subjects?.subject_name || "Lecture"
    candidates.push({
      action_type: "ATTEND_CLASS",
      title: `Attend ${subName}`,
      description: `Class is currently in session in room ${context.activeClass.room || "assigned hall"}.`,
      subject: subName,
      source: "class_schedule",
      page: "My Academics",
      action_url: "/academics",
      estimated_minutes: Math.max(15, timeToMinutes(context.activeClass.end_time) - context.nowMinutes),
      urgency: 100,
      impact: 95,
      risk: 90,
      timeRelevance: 100,
      importance: 90,
      effortPenalty: 0,
      isHardRule: true,
      hardRuleReason: "Class is currently active",
      whyThis: [
        "Class in session right now",
        `Ends at ${context.activeClass.end_time?.slice(0, 5)}`,
        `Room: ${context.activeClass.room || "N/A"}`,
      ],
      payload: context.activeClass,
    })
  } else if (context.upcomingSoonClass) {
    const subName = context.upcomingSoonClass.academic_subjects?.subject_name || "Lecture"
    const minsLeft = timeToMinutes(context.upcomingSoonClass.start_time) - context.nowMinutes
    candidates.push({
      action_type: "ATTEND_CLASS",
      title: `Go to ${subName} (${minsLeft}m)`,
      description: `Class starts at ${context.upcomingSoonClass.start_time?.slice(0, 5)} in room ${context.upcomingSoonClass.room || "hall"}.`,
      subject: subName,
      source: "class_schedule",
      page: "My Academics",
      action_url: "/academics",
      estimated_minutes: minsLeft,
      urgency: 98,
      impact: 90,
      risk: 85,
      timeRelevance: 100,
      importance: 90,
      effortPenalty: 0,
      isHardRule: true,
      hardRuleReason: `Class begins in ${minsLeft} minutes`,
      whyThis: [
        `Starts at ${context.upcomingSoonClass.start_time?.slice(0, 5)} (${minsLeft} mins left)`,
        `Room: ${context.upcomingSoonClass.room || "N/A"}`,
        `Teacher: ${context.upcomingSoonClass.teacher_name || "Faculty"}`,
      ],
      payload: context.upcomingSoonClass,
    })
  }

  // 2. Pending Task / Assignment Actions
  for (const task of context.pendingTasks) {
    const hours = getHoursRemaining(task.deadline)
    const days = Math.ceil(hours / 24)
    const importance = Number(task.importance || 5)

    let urgency = 40
    if (hours <= 6) urgency = 98
    else if (hours <= 12) urgency = 94
    else if (hours <= 24) urgency = 90
    else if (hours <= 48) urgency = 75
    else if (days <= 5) urgency = 55

    const impact = importance * 10
    const risk = hours <= 24 ? 90 : hours <= 48 ? 65 : 35
    const isImminent = hours <= 24 || importance >= 9

    candidates.push({
      action_type: hours <= 24 ? "SUBMIT_ASSIGNMENT" : "COMPLETE_ASSIGNMENT",
      title: task.title,
      description: `Pending task for ${task.subject || "academics"} due in ${hours <= 24 ? `${hours} hours` : `${days} days`}.`,
      subject: task.subject || "Academics",
      source: "tasks",
      page: "Tasks",
      action_url: "/tasks",
      estimated_minutes: Number(task.estimated_minutes || 30),
      deadline: task.deadline,
      urgency,
      impact,
      risk,
      timeRelevance: hours <= 24 ? 95 : 60,
      importance: impact,
      effortPenalty: Number(task.estimated_minutes || 30) > 90 ? 10 : 0,
      isHardRule: isImminent,
      hardRuleReason: hours <= 24 ? "Due within 24 hours" : importance >= 9 ? "Critical high-importance assignment" : null,
      whyThis: [
        hours <= 24 ? `⚠️ Due in ${hours} hours` : `Due in ${days} days`,
        `Importance: ${importance}/10`,
        `Estimated time: ${task.estimated_minutes || 30} mins`,
      ],
      payload: task,
    })
  }

  // 3. Exam Preparation Actions
  for (const exam of context.upcomingExams) {
    const days = getDaysRemaining(exam.exam_date)
    const examImportance = Number(exam.importance || 8)

    const examSubj = (exam.subject || "").toLowerCase()
    // Find weakest topics for this exam subject
    const subjectTopics = context.topicsWithMastery.filter((t) => {
      const tSubj = (t.subject_name || "").toLowerCase()
      const tCode = (t.subject_code || "").toLowerCase()
      return (
        (tSubj && examSubj && tSubj.includes(examSubj)) ||
        (examSubj && tSubj && examSubj.includes(tSubj)) ||
        (tCode && examSubj && examSubj.includes(tCode))
      )
    })

    const weakestExamTopic = subjectTopics.sort((a, b) => a.mastery_score - b.mastery_score)[0]
    const lowestMastery = weakestExamTopic ? Number(weakestExamTopic.mastery_score || 0) : 50

    let urgency = 40
    if (days <= 1) urgency = 99
    else if (days <= 3) urgency = 92
    else if (days <= 7) urgency = 75
    else if (days <= 14) urgency = 50

    const impact = examImportance * 10
    const risk = 100 - lowestMastery
    const isDangerous = days <= 3 && lowestMastery < 60

    candidates.push({
      action_type: "PREPARE_FOR_EXAM",
      title: `Prepare for ${exam.subject}`,
      description: weakestExamTopic
        ? `Target high-risk topic "${weakestExamTopic.topic_name}" (${lowestMastery}% mastery) before the exam in ${days} days.`
        : `Exam is ${days} day${days === 1 ? "" : "s"} away. Complete practice tests and revision.`,
      subject: exam.subject,
      source: "exams + syllabus",
      page: "Exam Mode",
      action_url: "/exam-mode",
      estimated_minutes: 60,
      deadline: exam.exam_date,
      urgency,
      impact,
      risk,
      timeRelevance: days <= 3 ? 95 : 65,
      importance: impact,
      effortPenalty: 5,
      isHardRule: isDangerous,
      hardRuleReason: isDangerous ? `Exam is ${days} days away with ${lowestMastery}% topic mastery` : null,
      whyThis: [
        `Exam date: ${new Date(exam.exam_date).toLocaleDateString()}`,
        `Urgency: ${days} day${days === 1 ? "" : "s"} remaining`,
        weakestExamTopic
          ? `Highest risk topic: ${weakestExamTopic.topic_name} (${lowestMastery}%)`
          : `Exam Importance: ${examImportance}/10`,
      ],
      payload: { exam, weakestTopic: weakestExamTopic },
    })
  }

  // 4. Study / Revise Weakest Topics
  if (context.weakestTopics.length > 0) {
    const topWeakTopic = context.weakestTopics[0]
    const studyMins = context.studyWindow ? context.studyWindow.minutes : 45

    candidates.push({
      action_type: "STUDY_TOPIC",
      title: `Study ${topWeakTopic.topic_name}`,
      description: `Improve your lowest recorded syllabus topic (${topWeakTopic.mastery_score}% mastery) with practice quizzes and revision notes.`,
      subject: topWeakTopic.subject_name || "Syllabus",
      source: "student_topic_progress",
      page: "Progress",
      action_url: "/progress",
      estimated_minutes: studyMins,
      urgency: 55,
      impact: 75,
      risk: 100 - Number(topWeakTopic.mastery_score || 0),
      timeRelevance: context.studyWindow ? 90 : 50,
      importance: 70,
      effortPenalty: 0,
      isHardRule: false,
      whyThis: [
        `Current mastery: ${topWeakTopic.mastery_score}% (${topWeakTopic.status || "not started"})`,
        context.studyWindow
          ? `Fits available study window (${context.studyWindow.start} - ${context.studyWindow.end})`
          : "Highest impact syllabus improvement",
        "Take a 5-question AI quiz to boost mastery",
      ],
      payload: topWeakTopic,
    })
  }

  // 5. Fallback Review
  candidates.push({
    action_type: "REVIEW_SCHEDULE",
    title: "Review Academic Plan",
    description: "Review today's syllabus progression, check tomorrow's timetable, and maintain study momentum.",
    subject: "Academic Overview",
    source: "dashboard",
    page: "Progress",
    action_url: "/progress",
    estimated_minutes: 15,
    urgency: 25,
    impact: 40,
    risk: 10,
    timeRelevance: 30,
    importance: 40,
    effortPenalty: 0,
    isHardRule: false,
    whyThis: [
      "No critical immediate deadlines",
      "Keep progress updated across semester courses",
      "Plan tomorrow's lecture schedule",
    ],
    payload: null,
  })

  return candidates
}

/**
 * 95C: Priority Scoring Model
 * Score = 30% Urgency + 25% Academic Impact + 20% Risk + 15% Time Relevance + 10% Importance - Effort Penalty
 */
export function scoreCandidateAction(candidate) {
  const weightedScore =
    0.30 * Number(candidate.urgency || 0) +
    0.25 * Number(candidate.impact || 0) +
    0.20 * Number(candidate.risk || 0) +
    0.15 * Number(candidate.timeRelevance || 0) +
    0.10 * Number(candidate.importance || 0) -
    Number(candidate.effortPenalty || 0)

  return Math.max(0, Math.min(100, Math.round(weightedScore)))
}

/**
 * 95D & 95E: Hard-Priority Rules and Best-Action Selector
 */
export function runNextBestActionEngine(rawContext) {
  const context = buildAcademicContext(rawContext)
  const candidates = generateCandidateActions(context)

  // Score all candidates
  const scoredCandidates = candidates.map((c) => {
    const computedScore = scoreCandidateAction(c)
    const priority =
      computedScore >= 85 || c.isHardRule
        ? "CRITICAL"
        : computedScore >= 70
          ? "HIGH"
          : computedScore >= 45
            ? "MEDIUM"
            : "LOW"

    return {
      ...c,
      score: computedScore,
      priority,
      reason: c.hardRuleReason || c.description,
    }
  })

  // Hard Rule Overrides:
  // Rule 1: Class Active or Starting soon (<30m)
  const classAction = scoredCandidates.find((c) => c.action_type === "ATTEND_CLASS" && c.isHardRule)
  if (classAction) {
    const others = scoredCandidates.filter((c) => c !== classAction).slice(0, 3)
    return {
      bestAction: classAction,
      otherPriorities: others,
      allCandidates: scoredCandidates,
    }
  }

  // Rule 2: Imminent task (<24h)
  const imminentTask = scoredCandidates.find((c) => (c.action_type === "SUBMIT_ASSIGNMENT" || c.action_type === "COMPLETE_ASSIGNMENT") && c.isHardRule)

  // Rule 3: Imminent Exam (<3 days with low mastery)
  const imminentExam = scoredCandidates.find((c) => c.action_type === "PREPARE_FOR_EXAM" && c.isHardRule)

  if (imminentExam && imminentTask) {
    // Both active: compare scores
    const first = imminentExam.score >= imminentTask.score ? imminentExam : imminentTask
    const others = scoredCandidates.filter((c) => c !== first).slice(0, 3)
    return {
      bestAction: first,
      otherPriorities: others,
      allCandidates: scoredCandidates,
    }
  }

  if (imminentExam) {
    const others = scoredCandidates.filter((c) => c !== imminentExam).slice(0, 3)
    return {
      bestAction: imminentExam,
      otherPriorities: others,
      allCandidates: scoredCandidates,
    }
  }

  if (imminentTask) {
    const others = scoredCandidates.filter((c) => c !== imminentTask).slice(0, 3)
    return {
      bestAction: imminentTask,
      otherPriorities: others,
      allCandidates: scoredCandidates,
    }
  }

  // Standard Ranking by Score
  scoredCandidates.sort((a, b) => b.score - a.score)

  const bestAction = scoredCandidates[0]
  const otherPriorities = scoredCandidates.slice(1, 4)

  return {
    bestAction,
    otherPriorities,
    allCandidates: scoredCandidates,
  }
}
