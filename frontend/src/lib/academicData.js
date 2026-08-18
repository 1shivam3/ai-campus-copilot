import { supabase } from "./supabase"
import {
  saveClassSchedule,
  getCachedClassSchedule,
  saveAcademicSubjects,
  getCachedAcademicSubjects,
} from "./offlineDb"

/**
 * Cache-First Academic Schedule & Subject Loaders
 * Immediately renders local memory / IndexedDB records for instant 0ms load and offline access,
 * and refreshes from Supabase when network is connected.
 */

const memorySubjectsCache = new Map()
const memoryScheduleCache = new Map()

export async function getAcademicData(semester, section) {
  const cacheKey = `${semester}_${section}`
  if (memorySubjectsCache.has(cacheKey)) {
    return memorySubjectsCache.get(cacheKey)
  }

  const cachedSubjects = await getCachedAcademicSubjects(semester, section)
  if (cachedSubjects && cachedSubjects.length > 0) {
    const cachedResult = { subjects: cachedSubjects, labs: [] }
    memorySubjectsCache.set(cacheKey, cachedResult)
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      subjects: cachedSubjects || [],
      labs: [],
    }
  }

  try {
    const [subjectsResult, labsResult] = await Promise.all([
      supabase
        .from("academic_subjects")
        .select("id, semester, section, subject_name, subject_code, subject_type, credits, teacher_name")
        .eq("semester", semester)
        .eq("section", section)
        .order("subject_name"),

      supabase
        .from("lab_schedule")
        .select("id, semester, section, day_of_week, start_time, end_time, lab_name, room, batch")
        .eq("semester", semester)
        .eq("section", section)
        .order("day_of_week")
        .order("start_time"),
    ])

    const resultData = {
      subjects: subjectsResult.data || cachedSubjects || [],
      labs: labsResult.data || [],
    }

    if (!subjectsResult.error && subjectsResult.data) {
      saveAcademicSubjects(semester, section, subjectsResult.data)
      memorySubjectsCache.set(cacheKey, resultData)
    }

    return resultData
  } catch (err) {
    console.warn("[AcademicData] Online fetch notice, falling back to cache:", err)
    return {
      subjects: cachedSubjects || [],
      labs: [],
    }
  }
}

export async function getClassSchedule(semester, section) {
  const cacheKey = `${semester}_${section}`
  if (memoryScheduleCache.has(cacheKey)) {
    return memoryScheduleCache.get(cacheKey)
  }

  const cachedSchedule = await getCachedClassSchedule(semester, section)
  if (cachedSchedule && cachedSchedule.length > 0) {
    memoryScheduleCache.set(cacheKey, cachedSchedule)
  }

  // If offline, immediately return cached timetable
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return cachedSchedule || []
  }

  try {
    const { data, error } = await supabase
      .from("class_schedule")
      .select(`
        id,
        semester,
        section,
        day_of_week,
        start_time,
        end_time,
        room,
        subject_id,
        academic_subjects (
          subject_name,
          subject_code,
          subject_type
        )
      `)
      .eq("semester", semester)
      .eq("section", section)
      .order("day_of_week")
      .order("start_time")

    if (error) throw error

    if (data && data.length > 0) {
      saveClassSchedule(semester, section, data)
      memoryScheduleCache.set(cacheKey, data)
      return data
    }

    return cachedSchedule || []
  } catch (err) {
    console.warn("[AcademicData] Schedule online query notice, falling back to cache:", err)
    return cachedSchedule || []
  }
}
