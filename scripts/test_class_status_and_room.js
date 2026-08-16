/**
 * Test Suite: Class Status, Room Number Formatting & Time Boundaries
 * Validates deterministic current/next class calculations, countdowns, and room resolutions.
 */

import { parseTimeToMinutes, formatRoom, getClassStatus } from "../frontend/src/utils/classStatus.js"

function assert(condition, message) {
  if (!condition) {
    console.error(`  --> [FAIL] ${message}`)
    process.exit(1)
  }
}

console.log("\n=======================================================")
console.log("   COURSEPIOT HOMEPAGE CLASS CARD & ROOM AUDIT")
console.log("=======================================================\n")

// 1. Time to minutes parsing
console.log("[TEST 1/6] Time Parsing to Minutes Since Midnight...")
assert(parseTimeToMinutes("08:40") === 520, "08:40 should be 520 min")
assert(parseTimeToMinutes("09:40") === 580, "09:40 should be 580 min")
assert(parseTimeToMinutes("01:40 PM") === 820, "01:40 PM should be 820 min")
assert(parseTimeToMinutes("13:40") === 820, "13:40 should be 820 min")
assert(parseTimeToMinutes("03:40 PM") === 940, "03:40 PM should be 940 min")
console.log("  --> [PASS] 12-hour and 24-hour time strings parsed accurately.")

// 2. Room formatting & removal of TBD
console.log("[TEST 2/6] Authoritative Room Resolution (Zero TBD)...")
assert(formatRoom("117") === "Room 117", "117 should be Room 117")
assert(formatRoom("Room 117") === "Room 117", "Room 117 should remain Room 117")
assert(formatRoom("Lab 143") === "Room Lab 143" || formatRoom("143") === "Room 143", "143 should be Room 143")
assert(formatRoom(null) === "Room not available", "null room should be Room not available")
assert(formatRoom("") === "Room not available", "empty room should be Room not available")
assert(formatRoom("TBD") === "Room not available", "TBD should be Room not available")
assert(formatRoom("Room TBD") === "Room not available", "Room TBD should be Room not available")
console.log("  --> [PASS] Room formatted properly and TBD fallbacks prevented.")

// Sample Monday timetable matching real section B2
const sampleSchedule = [
  {
    id: 101,
    day_of_week: "Monday",
    start_time: "08:40:00",
    end_time: "09:40:00",
    room: "117",
    teacher_name: "Dr. Sharma",
    subject_name: "Data Structures",
    subject_code: "BCSE-501",
    academic_subjects: { subject_name: "Data Structures", subject_code: "BCSE-501", subject_type: "theory" }
  },
  {
    id: 102,
    day_of_week: "Monday",
    start_time: "09:40:00",
    end_time: "10:40:00",
    room: "118",
    teacher_name: "Prof. Verma",
    subject_name: "Database Management System",
    subject_code: "BCSE-503",
    academic_subjects: { subject_name: "Database Management System", subject_code: "BCSE-503", subject_type: "theory" }
  },
  {
    id: 103,
    day_of_week: "Monday",
    start_time: "11:40:00",
    end_time: "12:40:00",
    room: "119",
    teacher_name: "Dr. Gupta",
    subject_name: "Discrete Structures",
    subject_code: "BCSE-505",
    academic_subjects: { subject_name: "Discrete Structures", subject_code: "BCSE-505", subject_type: "theory" }
  },
  {
    id: 104,
    day_of_week: "Monday",
    start_time: "13:40:00",
    end_time: "15:40:00",
    room: "143",
    teacher_name: "Dr. Patel",
    subject_name: "Software Engineering Lab",
    subject_code: "BCSE-502L",
    academic_subjects: { subject_name: "Software Engineering Lab", subject_code: "BCSE-502L", subject_type: "lab" }
  }
]

// 3. Before First Class of Day (e.g. Monday 08:20)
console.log("[TEST 3/6] Before First Class Scenario (08:20)...")
const dateBeforeFirst = new Date("2026-08-17T08:20:00") // A Monday at 08:20
const statusBeforeFirst = getClassStatus(sampleSchedule, dateBeforeFirst)
assert(statusBeforeFirst.state === "next", "State should be 'next'")
assert(statusBeforeFirst.statusLabel === "NEXT CLASS", "Label should be 'NEXT CLASS'")
assert(statusBeforeFirst.classItem.subject_name === "Data Structures", "Next class should be Data Structures")
assert(statusBeforeFirst.classItem.formattedRoom === "Room 117", "Room should be Room 117")
assert(statusBeforeFirst.minutesUntilStart === 20, "Should start in 20 min")
assert(statusBeforeFirst.countdownText === "Starts in 20 min", "Countdown should say Starts in 20 min")
console.log("  --> [PASS] Before first class properly classified as NEXT CLASS with 20m countdown.")

// 4. During Class in Progress (09:00, 09:30, 09:35)
console.log("[TEST 4/6] Class In Progress Scenario (09:00, 09:30, 09:35)...")
// At 09:00 (Starts 08:40, Ends 09:40 -> 40 min remaining)
const dateAt0900 = new Date("2026-08-17T09:00:00")
const statusAt0900 = getClassStatus(sampleSchedule, dateAt0900)
assert(statusAt0900.state === "current", "09:00 state should be 'current'")
assert(statusAt0900.statusLabel === "CURRENT CLASS", "Label should be 'CURRENT CLASS'")
assert(statusAt0900.classItem.subject_name === "Data Structures", "Active class should be Data Structures")
assert(statusAt0900.minutesRemaining === 40, "Should have 40 min remaining")
assert(statusAt0900.countdownText === "Ends in 40 min", "Countdown should say Ends in 40 min")

// At 09:30 (10 min remaining)
const dateAt0930 = new Date("2026-08-17T09:30:00")
const statusAt0930 = getClassStatus(sampleSchedule, dateAt0930)
assert(statusAt0930.minutesRemaining === 10, "Should have 10 min remaining at 09:30")
assert(statusAt0930.countdownText === "Ends in 10 min", "Countdown should say Ends in 10 min")

// At 09:35 (5 min remaining)
const dateAt0935 = new Date("2026-08-17T09:35:00")
const statusAt0935 = getClassStatus(sampleSchedule, dateAt0935)
assert(statusAt0935.minutesRemaining === 5, "Should have 5 min remaining at 09:35")
assert(statusAt0935.countdownText === "Ends in 5 min", "Countdown should say Ends in 5 min")
console.log("  --> [PASS] In-progress class correctly tracked with dynamic countdowns.")

// 5. Boundary & Between Classes Transition (09:40 boundary & 11:00 gap)
console.log("[TEST 5/6] Boundary Transitions & Gaps (09:40 & 11:00)...")
// Exactly on 09:40 boundary -> Class 2 starts
const dateAt0940 = new Date("2026-08-17T09:40:00")
const statusAt0940 = getClassStatus(sampleSchedule, dateAt0940)
assert(statusAt0940.state === "current", "At 09:40 state should be 'current'")
assert(statusAt0940.classItem.subject_name === "Database Management System", "Active class should be DBMS")
assert(statusAt0940.classItem.formattedRoom === "Room 118", "Room should be Room 118")

// In gap at 11:00 (Class ended 10:40, next starts 11:40 -> 40 min until next)
const dateAt1100 = new Date("2026-08-17T11:00:00")
const statusAt1100 = getClassStatus(sampleSchedule, dateAt1100)
assert(statusAt1100.state === "next", "At 11:00 state should be 'next'")
assert(statusAt1100.classItem.subject_name === "Discrete Structures", "Upcoming class should be Discrete Structures")
assert(statusAt1100.minutesUntilStart === 40, "Starts in 40 min")
assert(statusAt1100.countdownText === "Starts in 40 min", "Countdown text should say Starts in 40 min")
console.log("  --> [PASS] Boundary transition and break gap behavior verified.")

// 6. After All Classes & Weekend / No Classes
console.log("[TEST 6/6] All Classes Complete & Weekend Scenarios...")
// At 16:30 (After lab ended at 15:40)
const dateAt1630 = new Date("2026-08-17T16:30:00")
const statusAt1630 = getClassStatus(sampleSchedule, dateAt1630)
assert(statusAt1630.state === "completed", "At 16:30 state should be 'completed'")
assert(statusAt1630.statusLabel === "ALL CLASSES COMPLETE", "Label should be 'ALL CLASSES COMPLETE'")
assert(statusAt1630.totalClasses === 4, "Total classes should be 4")

// Weekend (Sunday)
const dateSunday = new Date("2026-08-16T10:00:00")
const statusSunday = getClassStatus(sampleSchedule, dateSunday)
assert(statusSunday.state === "none", "Sunday state should be 'none'")
assert(statusSunday.statusLabel === "NO CLASSES TODAY", "Sunday label should be 'NO CLASSES TODAY'")
console.log("  --> [PASS] Completed day and weekend / no-class states verified.")

console.log("\n=======================================================")
console.log(" ALL HOMEPAGE CLASS & ROOM TESTS PASSED (100% SUCCESS)")
console.log("=======================================================\n")
