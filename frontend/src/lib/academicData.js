import { supabase } from "./supabase"
import {
  saveClassSchedule,
  getCachedClassSchedule,
  saveAcademicSubjects,
  getCachedAcademicSubjects,
  saveLabSchedule,
  getCachedLabSchedule,
} from "./offlineDb"

/**
 * Cache-First Academic Schedule & Subject Loaders
 * Immediately renders local memory / IndexedDB records for instant 0ms load and offline access,
 * and refreshes from Supabase when network is connected.
 */

const memorySubjectsCache = new Map()
const memoryScheduleCache = new Map()

export function clearAcademicMemoryCache() {
  memorySubjectsCache.clear()
  memoryScheduleCache.clear()
}

export async function getAcademicData(semester, section) {
  const cacheKey = `${semester}_${section}`
  if (memorySubjectsCache.has(cacheKey)) {
    return memorySubjectsCache.get(cacheKey)
  }

  const [cachedSubjects, cachedLabs] = await Promise.all([
    getCachedAcademicSubjects(semester, section),
    getCachedLabSchedule(semester, section),
  ])

  if ((cachedSubjects && cachedSubjects.length > 0) || (cachedLabs && cachedLabs.length > 0)) {
    const cachedResult = {
      subjects: cachedSubjects || [],
      labs: cachedLabs || [],
    }
    memorySubjectsCache.set(cacheKey, cachedResult)
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      subjects: cachedSubjects || [],
      labs: cachedLabs || [],
    }
  }

  try {
    const [subjectsResult, labsResult] = await Promise.all([
      supabase
        .from("academic_subjects")
        .select("id, semester, section, subject_name, subject_code, subject_type, teacher_name, room")
        .eq("semester", Number(semester))
        .eq("section", String(section))
        .order("subject_name"),

      supabase
        .from("lab_schedule")
        .select("id, semester, section, day_of_week, start_time, end_time, subject_name, lab_room, teacher_name")
        .eq("semester", Number(semester))
        .eq("section", String(section))
        .order("day_of_week")
        .order("start_time"),
    ])

    if (subjectsResult.error) {
      console.warn("[AcademicData] Subjects fetch warning:", subjectsResult.error)
    }
    if (labsResult.error) {
      console.warn("[AcademicData] Labs fetch warning:", labsResult.error)
    }

    const fetchedSubjects = subjectsResult.data || cachedSubjects || []
    const fetchedLabs = labsResult.data || cachedLabs || []

    const resultData = {
      subjects: fetchedSubjects,
      labs: fetchedLabs,
    }

    if (!subjectsResult.error && subjectsResult.data) {
      saveAcademicSubjects(semester, section, subjectsResult.data)
    }
    if (!labsResult.error && labsResult.data) {
      saveLabSchedule(semester, section, labsResult.data)
    }

    memorySubjectsCache.set(cacheKey, resultData)
    return resultData
  } catch (err) {
    console.warn("[AcademicData] Online fetch notice, falling back to cache:", err)
    return {
      subjects: cachedSubjects || [],
      labs: cachedLabs || [],
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
        teacher_name,
        subject_id,
        academic_subjects (
          id,
          subject_name,
          subject_code,
          subject_type,
          teacher_name,
          room
        )
      `)
      .eq("semester", Number(semester))
      .eq("section", String(section))
      .order("day_of_week")
      .order("start_time")

    if (error) throw error

    if (data && data.length > 0) {
      const normalized = data.map((item) => ({
        ...item,
        teacher_name: item.teacher_name || item.academic_subjects?.teacher_name || "",
        room: item.room || item.academic_subjects?.room || "",
      }))

      saveClassSchedule(semester, section, normalized)
      memoryScheduleCache.set(cacheKey, normalized)
      return normalized
    }

    return cachedSchedule || []
  } catch (err) {
    console.warn("[AcademicData] Schedule online query notice, falling back to cache:", err)
    return cachedSchedule || []
  }
}
