export function getFreeWindows(
  schedule,
  date = new Date()
) {
  if (!schedule || !Array.isArray(schedule)) return []

  const today = date.toLocaleDateString("en-US", {
    weekday: "long",
  })

  const todayClasses = schedule
    .filter((item) => item.day_of_week?.toLowerCase() === today.toLowerCase())
    .sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    )

  const windows = []

  const dayStart = "08:40"
  const dayEnd = "17:40"

  let cursor = dayStart

  for (const item of todayClasses) {
    const classStart = item.start_time?.slice(0, 5)
    const classEnd = item.end_time?.slice(0, 5)

    if (classStart > cursor) {
      const minutes = getMinutesBetween(cursor, classStart)
      if (minutes >= 15) {
        windows.push({
          start: cursor,
          end: classStart,
          minutes,
        })
      }
    }

    if (classEnd > cursor) {
      cursor = classEnd
    }
  }

  if (cursor < dayEnd) {
    const minutes = getMinutesBetween(cursor, dayEnd)
    if (minutes >= 15) {
      windows.push({
        start: cursor,
        end: dayEnd,
        minutes,
      })
    }
  }

  return windows
}

function getMinutesBetween(start, end) {
  const [startHour, startMinute] =
    start.split(":").map(Number)

  const [endHour, endMinute] =
    end.split(":").map(Number)

  return (
    endHour * 60 +
    endMinute -
    (startHour * 60 + startMinute)
  )
}

export function getBestStudyWindow(
  schedule,
  requiredMinutes = 30,
  date = new Date()
) {
  const windows = getFreeWindows(schedule, date)

  return (
    windows
      .filter((window) => window.minutes >= requiredMinutes)
      .sort((a, b) => a.minutes - b.minutes)[0] || null
  )
}
