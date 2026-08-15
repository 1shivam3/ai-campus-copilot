import Papa from "papaparse"
import { supabase } from "./supabase"

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error),
    })
  })
}

export async function importSubjects(file) {
  const rows = await parseCsv(file)

  const records = rows
    .filter((row) => row.subject_name)
    .map((row) => ({
      semester: Number(row.semester),
      section: row.section,
      subject_code: row.subject_code || null,
      subject_name: row.subject_name,
      subject_type: row.subject_type || "Theory",
      teacher_name: row.teacher_name || null,
      room: row.room || null,
    }))

  const { data, error } = await supabase
    .from("academic_subjects")
    .insert(records)
    .select()

  if (error) throw error

  return data
}

export async function importTimetable(file) {
  const rows = await parseCsv(file)

  const records = []

  for (const row of rows) {
    if (!row.subject_code) continue

    const { data: subject, error } = await supabase
      .from("academic_subjects")
      .select("id")
      .eq("semester", Number(row.semester))
      .eq("section", row.section)
      .eq("subject_code", row.subject_code)
      .maybeSingle()

    if (error) throw error

    if (!subject) continue

    records.push({
      semester: Number(row.semester),
      section: row.section,
      subject_id: subject.id,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      room: row.room || null,
      teacher_name: row.teacher_name || null,
    })
  }

  if (records.length === 0) {
    throw new Error("No matching subjects found for timetable.")
  }

  const { data, error } = await supabase
    .from("class_schedule")
    .insert(records)
    .select()

  if (error) throw error

  return data
}

export async function importLabs(file) {
  const rows = await parseCsv(file)

  const records = rows
    .filter((row) => row.subject_name)
    .map((row) => ({
      semester: Number(row.semester),
      section: row.section,
      subject_name: row.subject_name,
      day_of_week: row.day_of_week,
      start_time: row.start_time,
      end_time: row.end_time,
      lab_room: row.lab_room || null,
      teacher_name: row.teacher_name || null,
    }))

  const { data, error } = await supabase
    .from("lab_schedule")
    .insert(records)
    .select()

  if (error) throw error

  return data
}

export async function importSyllabus(file) {
  const rows = await parseCsv(file)

  const records = []

  for (const row of rows) {
    if (!row.subject_code || !row.topic_name) continue

    const { data: subject, error } = await supabase
      .from("academic_subjects")
      .select("id")
      .eq("semester", Number(row.semester))
      .eq("subject_code", row.subject_code)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!subject) continue

    records.push({
      subject_id: subject.id,
      unit_number: Number(row.unit_number),
      topic_name: row.topic_name,
      description: row.description || null,
    })
  }

  if (records.length === 0) {
    throw new Error("No matching subjects found for syllabus.")
  }

  const { data, error } = await supabase
    .from("syllabus_topics")
    .insert(records)
    .select()

  if (error) throw error

  return data
}
