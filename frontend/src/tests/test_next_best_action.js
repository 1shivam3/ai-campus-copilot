import { runNextBestActionEngine, buildAcademicContext } from "../utils/nextBestActionEngine.js"

console.log("=== RUNNING NEXT BEST ACTION ENGINE COMPREHENSIVE REGRESSION TESTS ===")

// Test 1: Pending assignment due soon (<6 hours)
const test1 = runNextBestActionEngine({
  tasks: [{ id: "t1", title: "OS Lab Report 3", subject: "Operating Systems", deadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(), importance: 9 }],
  exams: [],
  syllabusTopics: [],
  schedule: [],
})
console.log("Test 1 (Pending urgent assignment):", test1?.bestAction?.action_type, "-", test1?.bestAction?.title, "| CTA Page:", test1?.bestAction?.page)
if (test1?.bestAction?.action_type !== "SUBMIT_ASSIGNMENT" || test1?.bestAction?.page !== "Tasks") {
  throw new Error("Test 1 Failed: Expected SUBMIT_ASSIGNMENT targeting Tasks")
}

// Test 2: Upcoming exam within 2 days with low topic mastery
const test2 = runNextBestActionEngine({
  tasks: [],
  exams: [{ id: "e1", subject: "Data Structures", exam_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), importance: 9 }],
  syllabusTopics: [{ id: "tp1", topic_name: "Red-Black Trees", subject_name: "Data Structures", mastery_score: 30 }],
  schedule: [],
})
console.log("Test 2 (Imminent exam with weak topic):", test2?.bestAction?.action_type, "-", test2?.bestAction?.title, "| CTA Page:", test2?.bestAction?.page)
if (test2?.bestAction?.action_type !== "PREPARE_FOR_EXAM" || test2?.bestAction?.page !== "Exam Mode") {
  throw new Error("Test 2 Failed: Expected PREPARE_FOR_EXAM targeting Exam Mode")
}

// Test 3: Weak syllabus topic
const test3 = runNextBestActionEngine({
  tasks: [],
  exams: [],
  syllabusTopics: [{ id: "tp1", topic_name: "Dynamic Programming", subject_name: "Algorithms", mastery_score: 25 }],
  studyWindow: { start: "14:00", end: "15:00", minutes: 60 },
  schedule: [],
})
console.log("Test 3 (Weak syllabus topic in open study window):", test3?.bestAction?.action_type, "-", test3?.bestAction?.title, "| CTA Page:", test3?.bestAction?.page)
if (test3?.bestAction?.action_type !== "STUDY_TOPIC" || test3?.bestAction?.page !== "Progress") {
  throw new Error("Test 3 Failed: Expected STUDY_TOPIC targeting Progress")
}

// Test 4: Multiple competing priorities (active class vs exam vs task)
const test4 = runNextBestActionEngine({
  tasks: [{ id: "t1", title: "Assignment 1", subject: "Math", deadline: new Date(Date.now() + 5 * 3600 * 1000).toISOString(), importance: 8 }],
  exams: [{ id: "e1", subject: "Data Structures", exam_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(), importance: 9 }],
  syllabusTopics: [{ id: "tp1", topic_name: "Trees", subject_name: "Data Structures", mastery_score: 20 }],
  schedule: [],
})
console.log("Test 4 (Competing priorities):", test4?.bestAction?.action_type, "| Other priorities count:", test4?.otherPriorities?.length)
if (!test4?.bestAction || !test4?.otherPriorities || test4.otherPriorities.length === 0) {
  throw new Error("Test 4 Failed: Expected bestAction and otherPriorities list")
}

// Test 5: No urgent work
const test5 = runNextBestActionEngine({
  tasks: [],
  exams: [{ id: "e2", subject: "Ethics", exam_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(), importance: 4 }],
  syllabusTopics: [],
  schedule: [],
})
console.log("Test 5 (No urgent work):", test5?.bestAction?.action_type, "-", test5?.bestAction?.title)
if (!test5?.bestAction?.title) {
  throw new Error("Test 5 Failed: Expected valid fallback action")
}

// Test 6: Empty academic data
const test6 = runNextBestActionEngine({
  tasks: [],
  exams: [],
  syllabusTopics: [],
  schedule: [],
})
console.log("Test 6 (Empty data):", test6?.bestAction?.action_type, "-", test6?.bestAction?.title)
if (!test6?.bestAction?.title) {
  throw new Error("Test 6 Failed: Expected valid fallback review action")
}

// Test 7: Null context
const test7 = runNextBestActionEngine(null)
console.log("Test 7 (Null context):", test7?.bestAction?.action_type, "-", test7?.bestAction?.title)
if (!test7?.bestAction?.title) {
  throw new Error("Test 7 Failed: Expected valid action from null context")
}

console.log("=== ALL 7 SCENARIOS PASSED WITH ZERO REGRESSIONS ===")
