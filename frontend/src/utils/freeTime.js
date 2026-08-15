/**
 * Calculates available free study windows by combining
 * CoursePilot academic timetable with Google Calendar events.
 */

export function getMinutesFromTimeString(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatMinutesToTimeString(totalMinutes) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function getMergedFreeWindows({
  schedule = [],
  calendarEvents = [],
  date = new Date(),
  dayStart = "08:00",
  dayEnd = "22:00",
  minWindowMinutes = 15,
}) {
  const todayStr = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
  const todayDatePrefix = date.toISOString().slice(0, 10) // "YYYY-MM-DD"

  const busyIntervals = []

  // 1. Ingest CoursePilot timetable classes for today
  if (Array.isArray(schedule)) {
    schedule
      .filter((item) => item.day_of_week?.toLowerCase() === todayStr)
      .forEach((item) => {
        if (item.start_time && item.end_time) {
          const startMins = getMinutesFromTimeString(item.start_time)
          const endMins = getMinutesFromTimeString(item.end_time)
          if (endMins > startMins) {
            busyIntervals.push({ start: startMins, end: endMins, title: item.academic_subjects?.subject_name || "Lecture" })
          }
        }
      })
  }

  // 2. Ingest Google Calendar events for today
  if (Array.isArray(calendarEvents)) {
    calendarEvents.forEach((event) => {
      if (event.status === "cancelled") return

      // Handle all-day events
      if (event.start?.date && !event.start?.dateTime) {
        if (event.start.date <= todayDatePrefix && (!event.end?.date || event.end.date > todayDatePrefix)) {
          // Whole day busy
          busyIntervals.push({ start: getMinutesFromTimeString(dayStart), end: getMinutesFromTimeString(dayEnd), title: event.summary || "All Day Event" })
        }
        return
      }

      // Handle timed events
      const eventStart = event.start?.dateTime || event.start
      const eventEnd = event.end?.dateTime || event.end

      if (eventStart && eventEnd) {
        const startObj = new Date(eventStart)
        const endObj = new Date(eventEnd)

        // Check if event falls on today
        if (
          startObj.toLocaleDateString() === date.toLocaleDateString() ||
          (startObj <= date && endObj >= date)
        ) {
          const startMins = startObj.getHours() * 60 + startObj.getMinutes()
          const endMins = endObj.getHours() * 60 + endObj.getMinutes()

          if (endMins > startMins) {
            busyIntervals.push({
              start: startMins,
              end: endMins,
              title: event.summary || event.title || "Calendar Event",
            })
          }
        }
      }
    })
  }

  // If no busy events, the whole day is an open study window
  const dayStartMins = getMinutesFromTimeString(dayStart)
  const dayEndMins = getMinutesFromTimeString(dayEnd)

  if (busyIntervals.length === 0) {
    return [
      {
        start: dayStart,
        end: dayEnd,
        minutes: dayEndMins - dayStartMins,
      },
    ]
  }

  // 3. Sort intervals by start time
  busyIntervals.sort((a, b) => a.start - b.start)

  // 4. Merge overlapping or adjacent intervals
  const mergedBusy = []
  let current = { ...busyIntervals[0] }

  for (let i = 1; i < busyIntervals.length; i++) {
    const next = busyIntervals[i]
    if (next.start <= current.end) {
      // Overlap or contiguous -> extend
      current.end = Math.max(current.end, next.end)
    } else {
      mergedBusy.push(current)
      current = { ...next }
    }
  }
  mergedBusy.push(current)

  // 5. Invert busy intervals to extract free windows between dayStart and dayEnd
  const freeWindows = []
  let cursor = dayStartMins

  for (const interval of mergedBusy) {
    const blockStart = Math.max(dayStartMins, interval.start)
    const blockEnd = Math.min(dayEndMins, interval.end)

    if (blockStart > cursor) {
      const gapMinutes = blockStart - cursor
      if (gapMinutes >= minWindowMinutes) {
        freeWindows.push({
          start: formatMinutesToTimeString(cursor),
          end: formatMinutesToTimeString(blockStart),
          minutes: gapMinutes,
        })
      }
    }

    if (blockEnd > cursor) {
      cursor = blockEnd
    }
  }

  if (cursor < dayEndMins) {
    const gapMinutes = dayEndMins - cursor
    if (gapMinutes >= minWindowMinutes) {
      freeWindows.push({
        start: formatMinutesToTimeString(cursor),
        end: formatMinutesToTimeString(dayEndMins),
        minutes: gapMinutes,
      })
    }
  }

  return freeWindows
}

export function getFreeWindows(schedule, date = new Date()) {
  return getMergedFreeWindows({ schedule, calendarEvents: [], date, dayStart: "08:40", dayEnd: "17:40" })
}

export function getBestStudyWindow(
  schedule,
  requiredMinutes = 30,
  date = new Date(),
  calendarEvents = []
) {
  const windows = getMergedFreeWindows({
    schedule,
    calendarEvents,
    date,
    dayStart: "08:00",
    dayEnd: "22:00",
  })

  return (
    windows
      .filter((window) => window.minutes >= requiredMinutes)
      .sort((a, b) => a.minutes - b.minutes)[0] || null
  )
}
