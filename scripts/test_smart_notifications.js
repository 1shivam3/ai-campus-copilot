// Automated unit test suite for CoursePilot Smart Notifications System

import {
  generateSmartNotifications,
  isTimeInQuietHours,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../frontend/src/utils/notificationEngine.js"

let testsPassed = 0
let totalTests = 0

function assert(condition, testName) {
  totalTests++
  if (condition) {
    console.log(`✓ [PASS] ${testName}`)
    testsPassed++
  } else {
    console.error(`✗ [FAIL] ${testName}`)
  }
}

console.log("\n=======================================================")
console.log("CoursePilot Smart Notifications Test Suite")
console.log("=======================================================\n")

const fixedNow = new Date("2026-08-17T14:00:00Z")

// Test 1: Assignment approaching deadline (due in 8 hours -> HIGH priority)
const pendingTasks = [
  {
    id: 201,
    title: "Operating Systems Lab Report",
    subject: "Operating Systems",
    deadline: new Date(fixedNow.getTime() + 8 * 3600 * 1000).toISOString(),
    status: "pending",
  },
]

const notifs1 = generateSmartNotifications({
  tasks: pendingTasks,
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})

assert(notifs1.length === 1, "Test 1: Generates notification for assignment due in 8 hours")
assert(
  notifs1[0]?.priority === NOTIFICATION_PRIORITIES.HIGH,
  "Test 1b: Assignment due in 8h gets HIGH priority"
)

// Test 2: Imminent assignment deadline (due in 1 hour -> CRITICAL priority)
const urgentTasks = [
  {
    id: 202,
    title: "Discrete Math Quiz Submission",
    subject: "Mathematics",
    deadline: new Date(fixedNow.getTime() + 1 * 3600 * 1000).toISOString(),
    status: "pending",
  },
]
const notifs2 = generateSmartNotifications({
  tasks: urgentTasks,
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(
  notifs2[0]?.priority === NOTIFICATION_PRIORITIES.CRITICAL,
  "Test 2: Assignment due in 1h gets CRITICAL priority"
)

// Test 3: Completed assignment should NOT trigger notification
const completedTasks = [
  {
    id: 203,
    title: "DBMS Worksheet",
    subject: "DBMS",
    deadline: new Date(fixedNow.getTime() + 2 * 3600 * 1000).toISOString(),
    status: "completed",
  },
]
const notifs3 = generateSmartNotifications({
  tasks: completedTasks,
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(notifs3.length === 0, "Test 3: Completed tasks are ignored")

// Test 4: Upcoming Exam milestones (3 days -> HIGH priority)
const sampleExams = [
  {
    id: 301,
    subject: "Computer Networks",
    exam_date: new Date(fixedNow.getTime() + 3 * 24 * 3600 * 1000).toISOString(),
  },
]
const notifs4 = generateSmartNotifications({
  tasks: [],
  exams: sampleExams,
  syllabusTopics: [],
  topicProgress: {},
  studyWindows: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(notifs4.length === 1 && notifs4[0].type === NOTIFICATION_TYPES.UPCOMING_EXAM, "Test 4: Generates exam milestone reminder")
assert(notifs4[0].priority === NOTIFICATION_PRIORITIES.HIGH, "Test 4b: 3-day exam reminder assigned HIGH priority")

// Test 5: Weak topic alert for imminent exam
const weakTopics = [
  {
    id: 401,
    title: "TCP Congestion Control",
    academic_subjects: { subject_name: "Computer Networks" },
  },
]
const topicProgress = {
  401: { mastery_score: 32 },
}
const notifs5 = generateSmartNotifications({
  tasks: [],
  exams: sampleExams,
  syllabusTopics: weakTopics,
  topicProgress,
  studyWindows: [],
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(
  notifs5.some((n) => n.type === NOTIFICATION_TYPES.WEAK_TOPIC),
  "Test 5: Triggers weak topic alert for approaching exam"
)

// Test 6: Available study window notification
const studyWindows = [
  { start: "16:00", end: "17:00", minutes: 60 },
]
const notifs6 = generateSmartNotifications({
  tasks: [],
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows,
  bestAction: { title: "Study TCP Congestion Control" },
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(
  notifs6.some((n) => n.type === NOTIFICATION_TYPES.STUDY_REMINDER),
  "Test 6: Triggers study opportunity reminder when open window exists"
)

// Test 7: Duplicate Prevention (re-running with same deliveredKeys produces 0 new notifications)
const deliveredSet = new Set(notifs6.map((n) => n.dedup_key))
const notifs7 = generateSmartNotifications({
  tasks: [],
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows,
  bestAction: { title: "Study TCP Congestion Control" },
  preferences: DEFAULT_NOTIFICATION_PREFERENCES,
  deliveredKeys: deliveredSet,
  now: fixedNow,
})
assert(notifs7.length === 0, "Test 7: Duplicate prevention blocks previously delivered notification keys")

// Test 8: Quiet Hours calculation
const nightTime = new Date("2026-08-17T23:15:00") // 11:15 PM
const dayTime = new Date("2026-08-17T14:30:00") // 2:30 PM
assert(isTimeInQuietHours(nightTime, "22:30", "07:00") === true, "Test 8a: 23:15 is inside quiet hours (22:30-07:00)")
assert(isTimeInQuietHours(dayTime, "22:30", "07:00") === false, "Test 8b: 14:30 is outside quiet hours")

// Test 9: Disabled notification category in preferences
const disabledPrefs = {
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  assignment_reminders: false,
}
const notifs9 = generateSmartNotifications({
  tasks: pendingTasks,
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindows: [],
  preferences: disabledPrefs,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(notifs9.length === 0, "Test 9: Respects disabled assignment_reminders preference")

// Test 10: Global notifications disabled
const allDisabledPrefs = {
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  enabled: false,
}
const notifs10 = generateSmartNotifications({
  tasks: pendingTasks,
  exams: sampleExams,
  syllabusTopics: weakTopics,
  topicProgress,
  studyWindows,
  bestAction: { title: "Study TCP Congestion Control" },
  preferences: allDisabledPrefs,
  deliveredKeys: new Set(),
  now: fixedNow,
})
assert(notifs10.length === 0, "Test 10: Global toggle disabled yields 0 notifications")

console.log(`\nResults: ${testsPassed} of ${totalTests} tests passed (${Math.round((testsPassed / totalTests) * 100)}%).\n`)
