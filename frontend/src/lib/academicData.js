import { supabase } from "./supabase"

export async function getAcademicData(semester, section) {
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

  if (subjectsResult.error) {
    throw subjectsResult.error
  }

  if (labsResult.error) {
    throw labsResult.error
  }

  return {
    subjects: subjectsResult.data || [],
    labs: labsResult.data || [],
  }
}

export async function getClassSchedule(
  semester,
  section
) {
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

  if (error) {
    throw error
  }

  return data || []
}
