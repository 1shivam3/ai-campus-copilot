import { supabase } from "./supabase"
import {
  saveClassSchedule,
  getCachedClassSchedule,
  saveAcademicSubjects,
  getCachedAcademicSubjects,
} from "./offlineDb"

/**
 * Cache-First Academic Schedule & Subject Loaders
 * Immediately renders local IndexedDB records for instant 0ms load and offline access,
 * and refreshes from Supabase when network is connected.
 */

export async function getAcademicData(semester, section) {
  const cachedSubjects = await getCachedAcademicSubjects(semester, section)

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
        .select("*")
        .eq("semester", semester)
        .eq("section", section)
        .order("subject_name"),

      supabase
        .from("lab_schedule")
        .select("*")
        .eq("semester", semester)
        .eq("section", section)
        .order("day_of_week")
        .order("start_time"),
    ])

    if (!subjectsResult.error && subjectsResult.data) {
      saveAcademicSubjects(semester, section, subjectsResult.data)
    }

    return {
      subjects: subjectsResult.data || cachedSubjects || [],
      labs: labsResult.data || [],
    }
  } catch (err) {
    console.warn("[AcademicData] Online fetch notice, falling back to cache:", err)
    return {
      subjects: cachedSubjects || [],
      labs: [],
    }
  }
}

export async function getClassSchedule(semester, section) {
  const cachedSchedule = await getCachedClassSchedule(semester, section)

  // If offline, immediately return cached timetable
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return cachedSchedule || []
  }

  try {
    const { data, error } = await supabase
      .from("class_schedule")
      .select(`
        *,
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
      return data
    }

    return cachedSchedule || []
  } catch (err) {
    console.warn("[AcademicData] Schedule online query notice, falling back to cache:", err)
    return cachedSchedule || []
  }
}
