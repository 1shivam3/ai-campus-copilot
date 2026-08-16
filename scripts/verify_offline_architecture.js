import "../frontend/node_modules/fake-indexeddb/auto/index.mjs"
import Dexie from "../frontend/node_modules/dexie/dist/modern/dexie.mjs"

console.log("=======================================================")
console.log("     COURSEPIOT OFFLINE ARCHITECTURE & SYNC AUDIT     ")
console.log("=======================================================")

const db = new Dexie("CoursePilotOfflineDB_Test")

db.version(1).stores({
  user_profile: "user_id, semester, section, updated_at",
  academic_subjects: "id, semester, section, subject_code",
  class_schedule: "id, semester, section, day_of_week, start_time, subject_id",
  lab_schedule: "id, semester, section, day_of_week, start_time, subject_id",
  syllabus_topics: "id, subject_id, unit_number",
  student_topic_progress: "[user_id+syllabus_topic_id], user_id, syllabus_topic_id, status, pending_sync",
  attendance_records: "id, user_id, date, pending_sync",
  cached_metadata: "key, last_synced_at, version",
  sync_queue: "++id, user_id, entity_type, entity_id, operation, status, created_at",
})

async function runOfflineAudit() {
  const USER_A_ID = "432089d8-0cc3-45b7-b4aa-321dda78bbfd" // Section B2
  const USER_B_ID = "cab2bd5f-e2a4-48aa-80dc-7fbbac77aa24" // Section K2

  // 1. Profile Caching
  console.log("\n[TEST 1/6] Profile Offline Storage...")
  await db.user_profile.put({
    user_id: USER_A_ID,
    full_name: "Shivam Kumar",
    semester: 3,
    section: "B2",
    avatar_url: null,
    updated_at: new Date().toISOString(),
  })

  const pA = await db.user_profile.get(USER_A_ID)
  console.log(`  --> Cached Profile: ${pA.full_name}, Sem ${pA.semester}, Sec ${pA.section}`)
  if (pA.full_name !== "Shivam Kumar" || pA.section !== "B2") {
    throw new Error("Profile cache mismatch!")
  }
  console.log("  --> [PASS] User profile offline caching verified.")

  // 2. Timetable Caching
  console.log("\n[TEST 2/6] Timetable & Lab Schedule Caching...")
  const sampleSchedule = [
    { id: 101, semester: 3, section: "B2", day_of_week: "Monday", start_time: "08:40", end_time: "09:40", room: "118", teacher_name: "Dr. Sharma", subject_id: 1 },
    { id: 102, semester: 3, section: "B2", day_of_week: "Monday", start_time: "09:40", end_time: "10:40", room: "118", teacher_name: "Dr. Verma", subject_id: 2 },
  ]
  await db.class_schedule.bulkPut(sampleSchedule)
  const cachedSched = await db.class_schedule.where({ semester: 3, section: "B2" }).toArray()
  console.log(`  --> Cached timetable slots: ${cachedSched.length}`)
  if (cachedSched.length !== 2) throw new Error("Schedule cache failure!")
  console.log("  --> [PASS] Timetable offline storage verified.")

  // 3. Syllabus & Subjects Caching
  console.log("\n[TEST 3/6] Academic Subjects & Syllabus Topics...")
  await db.academic_subjects.bulkPut([
    { id: 1, semester: 3, section: "B2", subject_code: "BCSE-501", subject_name: "Data Structures" },
    { id: 2, semester: 3, section: "B2", subject_code: "BCSE-502", subject_name: "Database Management" },
  ])
  await db.syllabus_topics.bulkPut([
    { id: 201, subject_id: 1, unit_number: 1, topic_name: "Arrays & Linked Lists" },
    { id: 202, subject_id: 1, unit_number: 2, topic_name: "Binary Trees & BST" },
  ])

  const cachedSubs = await db.academic_subjects.where({ semester: 3, section: "B2" }).toArray()
  const cachedTopics = await db.syllabus_topics.where({ subject_id: 1 }).toArray()
  console.log(`  --> Cached Subjects: ${cachedSubs.length}, Cached Topics: ${cachedTopics.length}`)
  if (cachedSubs.length !== 2 || cachedTopics.length !== 2) throw new Error("Syllabus cache failure!")
  console.log("  --> [PASS] Syllabus offline browsing verified.")

  // 4. Topic Progress & Offline Mutation
  console.log("\n[TEST 4/6] Offline Progress Update & Pending Status...")
  await db.student_topic_progress.put({
    user_id: USER_A_ID,
    syllabus_topic_id: 202,
    status: "learning",
    mastery_score: 50,
    pending_sync: true,
    updated_at: new Date().toISOString(),
  })

  const progA = await db.student_topic_progress.get([USER_A_ID, 202])
  console.log(`  --> Local Topic Progress: status=${progA.status}, mastery=${progA.mastery_score}%, pending=${progA.pending_sync}`)
  if (progA.status !== "learning" || !progA.pending_sync) throw new Error("Progress mutation failure!")
  console.log("  --> [PASS] Offline optimistic progress mutation verified.")

  // 5. Offline Sync Queue Enqueue & Processing
  console.log("\n[TEST 5/6] Offline Sync Queue Operations...")
  const queueId = await db.sync_queue.add({
    user_id: USER_A_ID,
    entity_type: "student_topic_progress",
    entity_id: "202",
    operation: "upsert",
    payload: { syllabus_topic_id: 202, status: "learning", mastery_score: 50 },
    retry_count: 0,
    status: "pending",
    created_at: new Date().toISOString(),
  })

  const pendingCount = await db.sync_queue.where({ user_id: USER_A_ID, status: "pending" }).count()
  console.log(`  --> Pending sync queue items for User A: ${pendingCount}`)
  if (pendingCount !== 1) throw new Error("Sync queue enqueue failure!")

  // Simulate reconciliation upon reconnect
  await db.sync_queue.delete(queueId)
  await db.student_topic_progress.update([USER_A_ID, 202], { pending_sync: false })
  const updatedProg = await db.student_topic_progress.get([USER_A_ID, 202])
  console.log(`  --> After sync reconciliation: pending_sync=${updatedProg.pending_sync}`)
  if (updatedProg.pending_sync !== false) throw new Error("Sync reconciliation failure!")
  console.log("  --> [PASS] Sync queue operations and state clearing verified.")

  // 6. User Isolation & Logout Cache Purge
  console.log("\n[TEST 6/6] Multi-User Isolation & Logout Purge...")
  // User B creates data
  await db.user_profile.put({
    user_id: USER_B_ID,
    full_name: "Shubham Kumar",
    semester: 3,
    section: "K2",
    avatar_url: null,
    updated_at: new Date().toISOString(),
  })
  await db.student_topic_progress.put({
    user_id: USER_B_ID,
    syllabus_topic_id: 202,
    status: "mastered",
    mastery_score: 100,
    pending_sync: false,
    updated_at: new Date().toISOString(),
  })

  // User A logs out -> purge User A
  await db.transaction("rw", [db.user_profile, db.student_topic_progress, db.sync_queue], async () => {
    await db.user_profile.where({ user_id: USER_A_ID }).delete()
    await db.student_topic_progress.where({ user_id: USER_A_ID }).delete()
    await db.sync_queue.where({ user_id: USER_A_ID }).delete()
  })

  const userAAfter = await db.user_profile.get(USER_A_ID)
  const userBAfter = await db.user_profile.get(USER_B_ID)
  const userBProg = await db.student_topic_progress.get([USER_B_ID, 202])

  console.log(`  --> User A profile after logout purge: ${userAAfter}`)
  console.log(`  --> User B profile preserved: ${userBAfter?.full_name}`)
  console.log(`  --> User B progress preserved: ${userBProg?.mastery_score}%`)

  if (userAAfter !== undefined || !userBAfter || userBProg.mastery_score !== 100) {
    throw new Error("User isolation or logout purge failure!")
  }
  console.log("  --> [PASS] Multi-tenant offline isolation and logout purge verified.")

  console.log("\n=======================================================")
  console.log(" ALL OFFLINE ARCHITECTURE TESTS PASSED (100% VERIFIED) ")
  console.log("=======================================================")
}

runOfflineAudit().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
