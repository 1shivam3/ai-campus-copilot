// Automated unit and scenario test for Calendar Availability and Next Best Action integration

import { getMergedFreeWindows, getBestStudyWindow } from "../frontend/src/utils/freeTime.js"
import { runNextBestActionEngine } from "../frontend/src/utils/nextBestActionEngine.js"

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
console.log("CoursePilot Calendar Integration & Availability Test Suite")
console.log("=======================================================\n")

const fixedDate = new Date("2026-08-17T10:00:00") // Monday

// Test 1: Timetable only (No Google Calendar events)
const scheduleClasses = [
  {
    day_of_week: "Monday",
    start_time: "08:40:00",
    end_time: "10:30:00",
    academic_subjects: { subject_name: "Mathematics" },
  },
  {
    day_of_week: "Monday",
    start_time: "11:00:00",
    end_time: "13:00:00",
    academic_subjects: { subject_name: "Operating Systems" },
  },
  {
    day_of_week: "Monday",
    start_time: "14:00:00",
    end_time: "16:00:00",
    academic_subjects: { subject_name: "DBMS" },
  },
]

const windows1 = getMergedFreeWindows({
  schedule: scheduleClasses,
  calendarEvents: [],
  date: fixedDate,
  dayStart: "08:00",
  dayEnd: "22:00",
})
assert(windows1.length > 0, "Test 1: Generates free windows from CoursePilot timetable")

// Test 2: Merged with Google Calendar events (Gym 17:00-18:00, Dinner 19:30-20:00)
const googleEvents = [
  {
    id: "evt_1",
    summary: "Gym Session",
    start: { dateTime: "2026-08-17T17:00:00" },
    end: { dateTime: "2026-08-17T18:00:00" },
    status: "confirmed",
  },
  {
    id: "evt_2",
    summary: "Family Dinner",
    start: { dateTime: "2026-08-17T19:30:00" },
    end: { dateTime: "2026-08-17T20:00:00" },
    status: "confirmed",
  },
]

const windows2 = getMergedFreeWindows({
  schedule: scheduleClasses,
  calendarEvents: googleEvents,
  date: fixedDate,
  dayStart: "08:00",
  dayEnd: "22:00",
})

// Free periods should include: 16:00-17:00 (60m), 18:00-19:30 (90m), 20:00-22:00 (120m)
const eveningSlot = windows2.find((w) => w.start === "20:00" && w.end === "22:00")
assert(Boolean(eveningSlot && eveningSlot.minutes === 120), "Test 2: Correctly identifies 20:00-22:00 (120m) evening study window")

// Test 3: Overlapping events resolution
const overlappingEvents = [
  {
    id: "evt_3",
    summary: "Study Group A",
    start: { dateTime: "2026-08-17T16:00:00" },
    end: { dateTime: "2026-08-17T17:30:00" },
    status: "confirmed",
  },
  {
    id: "evt_4",
    summary: "Study Group B",
    start: { dateTime: "2026-08-17T17:00:00" },
    end: { dateTime: "2026-08-17T18:00:00" },
    status: "confirmed",
  },
]

const windows3 = getMergedFreeWindows({
  schedule: [],
  calendarEvents: overlappingEvents,
  date: fixedDate,
  dayStart: "15:00",
  dayEnd: "19:00",
})
// Merged busy is 16:00-18:00, free are 15:00-16:00 (60m) and 18:00-19:00 (60m)
assert(windows3.length === 2 && windows3[0].start === "15:00" && windows3[0].end === "16:00", "Test 3: Merges overlapping calendar events cleanly")

// Test 4: All-day event occupying the day
const allDayEvents = [
  {
    id: "evt_allday",
    summary: "Hackathon Day",
    start: { date: "2026-08-17" },
    end: { date: "2026-08-18" },
    status: "confirmed",
  },
]
const windows4 = getMergedFreeWindows({
  schedule: [],
  calendarEvents: allDayEvents,
  date: fixedDate,
  dayStart: "08:00",
  dayEnd: "22:00",
})
assert(windows4.length === 0, "Test 4: All-day busy event results in 0 free study windows")

// Test 5: Best study window selection (requires 45 mins)
const bestWindow = getBestStudyWindow(scheduleClasses, 45, fixedDate, googleEvents)
assert(bestWindow !== null && bestWindow.minutes >= 45, "Test 5: Selects best available window matching minimum required duration")

// Test 6: Next Best Action integration with available calendar window
const candidateTasks = [
  {
    id: 101,
    title: "Complete Discrete Mathematics Assignment",
    subject: "Mathematics",
    deadline: new Date(Date.now() + 86400000).toISOString(),
    importance: "High",
    estimated_minutes: 45,
    status: "pending",
  },
]

const nbaResult = runNextBestActionEngine({
  profile: { semester: 3, section: "A" },
  schedule: [],
  tasks: candidateTasks,
  exams: [],
  syllabusTopics: [],
  topicProgress: {},
  studyWindow: bestWindow,
})

assert(nbaResult.bestAction !== null, "Test 6: Next Best Action generates recommendation with calendar study window context")
assert(
  nbaResult.bestAction.payload?.id === 101 ||
  nbaResult.bestAction.id === "task_101" ||
  nbaResult.bestAction.action_type === "COMPLETE_ASSIGNMENT",
  "Test 6b: Correctly prioritizes high-impact pending task fitting available window"
)

console.log(`\nResults: ${testsPassed} of ${totalTests} tests passed (${Math.round((testsPassed / totalTests) * 100)}%).\n`)
