export function getTodaySchedule(schedule, date = new Date()) {
  if (!schedule || !Array.isArray(schedule)) return []

  const today = date.toLocaleDateString("en-US", {
    weekday: "long",
  })

  return [...schedule]
    .filter((item) => item.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
}

export function getNextClass(schedule, date = new Date()) {
  if (!schedule || !Array.isArray(schedule)) return null

  const now = date.toTimeString().slice(0, 5)

  return (
    getTodaySchedule(schedule, date).find(
      (item) => item.end_time.slice(0, 5) > now
    ) || null
  )
}
