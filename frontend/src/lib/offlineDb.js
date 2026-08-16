import Dexie from "dexie"

/**
 * CoursePilot Local Offline Database (IndexedDB via Dexie)
 * Provides structured offline caching for timetable, syllabus, topic progress,
 * user profile, and an offline synchronization queue.
 */
export const db = new Dexie("CoursePilotOfflineDB")

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

// -------------------------------------------------------------
// USER PROFILE CACHE
// -------------------------------------------------------------
export async function saveUserProfile(profile) {
  if (!profile || !profile.id) return
  try {
    await db.user_profile.put({
      user_id: profile.id,
      full_name: profile.full_name || "Student",
      semester: Number(profile.semester) || 3,
      section: profile.section || "B2",
      avatar_url: profile.avatar_url || null,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn("[OfflineDB] saveUserProfile error:", err)
  }
}

export async function getCachedUserProfile(userId) {
  if (!userId) return null
  try {
    return await db.user_profile.get(userId)
  } catch (err) {
    console.warn("[OfflineDB] getCachedUserProfile error:", err)
    return null
  }
}

// -------------------------------------------------------------
// TIMETABLE & LAB SCHEDULE CACHE
// -------------------------------------------------------------
export async function saveClassSchedule(semester, section, scheduleList) {
  if (!semester || !section || !Array.isArray(scheduleList)) return
  try {
    await db.transaction("rw", db.class_schedule, db.cached_metadata, async () => {
      // Clear previous schedule for this semester & section
      await db.class_schedule
        .where({ semester: Number(semester), section: String(section) })
        .delete()

      const records = scheduleList.map((item) => ({
        id: item.id,
        semester: Number(item.semester || semester),
        section: String(item.section || section),
        day_of_week: item.day_of_week,
        start_time: item.start_time,
        end_time: item.end_time,
        room: item.room || "",
        teacher_name: item.teacher_name || "",
        subject_id: item.subject_id,
        academic_subjects: item.academic_subjects || null,
      }))

      await db.class_schedule.bulkPut(records)

      const metaKey = `schedule_${semester}_${section}`
      await db.cached_metadata.put({
        key: metaKey,
        value: { count: records.length },
        last_synced_at: new Date().toISOString(),
        version: 1,
      })
    })
  } catch (err) {
    console.warn("[OfflineDB] saveClassSchedule error:", err)
  }
}

export async function getCachedClassSchedule(semester, section) {
  if (!semester || !section) return []
  try {
    return await db.class_schedule
      .where({ semester: Number(semester), section: String(section) })
      .toArray()
  } catch (err) {
    console.warn("[OfflineDB] getCachedClassSchedule error:", err)
    return []
  }
}

// -------------------------------------------------------------
// ACADEMIC SUBJECTS & SYLLABUS CACHE
// -------------------------------------------------------------
export async function saveAcademicSubjects(semester, section, subjectsList) {
  if (!Array.isArray(subjectsList) || !subjectsList.length) return
  try {
    await db.transaction("rw", db.academic_subjects, db.cached_metadata, async () => {
      await db.academic_subjects
        .where({ semester: Number(semester), section: String(section) })
        .delete()

      await db.academic_subjects.bulkPut(
        subjectsList.map((s) => ({
          id: s.id,
          semester: Number(s.semester || semester),
          section: String(s.section || section),
          subject_code: s.subject_code,
          subject_name: s.subject_name,
          subject_type: s.subject_type || "Theory",
          teacher_name: s.teacher_name || "",
        }))
      )

      await db.cached_metadata.put({
        key: `subjects_${semester}_${section}`,
        value: { count: subjectsList.length },
        last_synced_at: new Date().toISOString(),
        version: 1,
      })
    })
  } catch (err) {
    console.warn("[OfflineDB] saveAcademicSubjects error:", err)
  }
}

export async function getCachedAcademicSubjects(semester, section) {
  if (!semester || !section) return []
  try {
    return await db.academic_subjects
      .where({ semester: Number(semester), section: String(section) })
      .toArray()
  } catch (err) {
    console.warn("[OfflineDB] getCachedAcademicSubjects error:", err)
    return []
  }
}

export async function saveSyllabusTopics(subjectId, topicsList) {
  if (!subjectId || !Array.isArray(topicsList)) return
  try {
    await db.transaction("rw", db.syllabus_topics, async () => {
      await db.syllabus_topics.where({ subject_id: Number(subjectId) }).delete()
      await db.syllabus_topics.bulkPut(
        topicsList.map((t) => ({
          id: t.id,
          subject_id: Number(t.subject_id || subjectId),
          unit_number: Number(t.unit_number || 1),
          topic_name: t.topic_name,
          description: t.description || "",
          academic_subjects: t.academic_subjects || null,
        }))
      )
    })
  } catch (err) {
    console.warn("[OfflineDB] saveSyllabusTopics error:", err)
  }
}

export async function getCachedSyllabusTopics(subjectId) {
  if (!subjectId) return []
  try {
    return await db.syllabus_topics
      .where({ subject_id: Number(subjectId) })
      .toArray()
  } catch (err) {
    console.warn("[OfflineDB] getCachedSyllabusTopics error:", err)
    return []
  }
}

// -------------------------------------------------------------
// STUDENT TOPIC PROGRESS (USER-SCOPED)
// -------------------------------------------------------------
export async function saveTopicProgress(userId, progressList) {
  if (!userId || !Array.isArray(progressList)) return
  try {
    const records = progressList.map((p) => ({
      user_id: userId,
      syllabus_topic_id: p.syllabus_topic_id || p.id,
      status: p.status || "not_started",
      mastery_score: Number(p.mastery_score) || 0,
      pending_sync: Boolean(p.pending_sync),
      updated_at: p.updated_at || new Date().toISOString(),
    }))
    await db.student_topic_progress.bulkPut(records)
  } catch (err) {
    console.warn("[OfflineDB] saveTopicProgress error:", err)
  }
}

export async function updateLocalTopicProgress(userId, topicId, status, masteryScore, pendingSync = true) {
  if (!userId || !topicId) return
  try {
    const record = {
      user_id: userId,
      syllabus_topic_id: Number(topicId),
      status,
      mastery_score: Number(masteryScore),
      pending_sync: pendingSync,
      updated_at: new Date().toISOString(),
    }
    await db.student_topic_progress.put(record)
    return record
  } catch (err) {
    console.warn("[OfflineDB] updateLocalTopicProgress error:", err)
  }
}

export async function getCachedTopicProgress(userId, topicIds) {
  if (!userId) return {}
  try {
    let records = []
    if (Array.isArray(topicIds) && topicIds.length > 0) {
      const numericIds = topicIds.map(Number)
      records = await db.student_topic_progress
        .where("user_id")
        .equals(userId)
        .filter((r) => numericIds.includes(r.syllabus_topic_id))
        .toArray()
    } else {
      records = await db.student_topic_progress
        .where("user_id")
        .equals(userId)
        .toArray()
    }

    const map = {}
    records.forEach((r) => {
      map[r.syllabus_topic_id] = r
    })
    return map
  } catch (err) {
    console.warn("[OfflineDB] getCachedTopicProgress error:", err)
    return {}
  }
}

// -------------------------------------------------------------
// METADATA & CHANGE DETECTION
// -------------------------------------------------------------
export async function getSyncMetadata(key) {
  try {
    return await db.cached_metadata.get(key)
  } catch {
    return null
  }
}

export async function setSyncMetadata(key, value = {}, version = 1) {
  try {
    await db.cached_metadata.put({
      key,
      value,
      last_synced_at: new Date().toISOString(),
      version,
    })
  } catch (err) {
    console.warn("[OfflineDB] setSyncMetadata error:", err)
  }
}

// -------------------------------------------------------------
// SECURITY: CLEAR USER-SCOPED CACHE ON LOGOUT
// -------------------------------------------------------------
export async function clearUserScopedCache(userId) {
  if (!userId) return
  try {
    await db.transaction(
      "rw",
      [db.user_profile, db.student_topic_progress, db.attendance_records, db.sync_queue],
      async () => {
        await db.user_profile.where({ user_id: userId }).delete()
        await db.student_topic_progress.where({ user_id: userId }).delete()
        await db.attendance_records.where({ user_id: userId }).delete()
        await db.sync_queue.where({ user_id: userId }).delete()
      }
    )
    console.info(`[OfflineDB] Cleared private offline cache for user=${userId}`)
  } catch (err) {
    console.warn("[OfflineDB] clearUserScopedCache error:", err)
  }
}
