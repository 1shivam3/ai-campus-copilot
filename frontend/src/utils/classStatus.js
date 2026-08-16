/**
 * CoursePilot Timetable & Class Status Utility
 * Authoritative status calculator for current, next, and completed classes.
 */

/**
 * Converts any 12-hour or 24-hour time string ("08:40", "08:40 AM", "02:15 PM", "14:15")
 * into minutes since midnight.
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0
  const clean = timeStr.trim()

  // Match formats like "08:40", "8:40", "08:40 AM", "02:15 PM", "2:15pm"
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?$/i)
  if (match12) {
    let hours = parseInt(match12[1], 10)
    const minutes = parseInt(match12[2], 10)
    const meridiem = match12[3] ? match12[3].toUpperCase() : null

    if (meridiem === "PM" && hours < 12) {
      hours += 12
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0
    }
    return hours * 60 + minutes
  }

  // Direct split fallback
  const parts = clean.split(":")
  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  return hours * 60 + minutes
}

/**
 * Normalizes room numbers to ensure standard formatting without TBD fallbacks.
 * e.g. "117" -> "Room 117", "Room 117" -> "Room 117", null -> "Room not available"
 */
export function formatRoom(room) {
  if (!room || typeof room !== "string") {
    return "Room not available"
  }
  const clean = room.trim()
  if (
    !clean ||
    clean.toUpperCase() === "TBD" ||
    clean.toUpperCase() === "NULL" ||
    clean.toUpperCase() === "ROOM TBD" ||
    clean.toUpperCase().includes("TBD")
  ) {
    return "Room not available"
  }
  if (clean.toLowerCase().startsWith("room")) {
    return clean
  }
  return `Room ${clean}`
}

/**
 * Deterministically determines the class state for the given schedule and current time.
 * Returns { state: "current" | "next" | "completed" | "none", classItem, minutesRemaining, minutesUntilStart, ... }
 */
export function getClassStatus(schedule = [], currentDate = new Date()) {
  const dayName = currentDate.toLocaleDateString("en-US", { weekday: "long" })
  const isWeekend = dayName === "Saturday" || dayName === "Sunday"

  // Filter and normalize today's classes
  const todaysClasses = (schedule || [])
    .filter((item) => item.day_of_week?.toLowerCase() === dayName.toLowerCase())
    .map((item) => {
      const startMinutes = parseTimeToMinutes(item.start_time)
      const endMinutes = parseTimeToMinutes(item.end_time)
      const roomValue = item.room || item.room_number || item.location || item.classroom
      return {
        ...item,
        startMinutes,
        endMinutes,
        formattedRoom: formatRoom(roomValue),
      }
    })
    .sort((a, b) => a.startMinutes - b.startMinutes)

  // Empty state if no classes scheduled today
  if (todaysClasses.length === 0) {
    return {
      state: "none",
      dayName,
      isWeekend,
      totalClasses: 0,
      todaysClasses: [],
      currentClass: null,
      nextClass: null,
      classItem: null,
      minutesRemaining: null,
      minutesUntilStart: null,
      statusLabel: "NO CLASSES TODAY",
      countdownText: isWeekend ? "Weekend Study / Rest" : "No classes scheduled today",
    }
  }

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()

  // 1. Check if a class is currently in progress: startMinutes <= currentMinutes < endMinutes
  const activeClass = todaysClasses.find(
    (item) => currentMinutes >= item.startMinutes && currentMinutes < item.endMinutes
  )

  if (activeClass) {
    const minutesRemaining = Math.max(0, activeClass.endMinutes - currentMinutes)
    const upcomingAfterActive =
      todaysClasses.find((item) => item.startMinutes >= activeClass.endMinutes) || null

    return {
      state: "current",
      dayName,
      isWeekend: false,
      totalClasses: todaysClasses.length,
      todaysClasses,
      currentClass: activeClass,
      classItem: activeClass,
      nextClass: upcomingAfterActive,
      minutesRemaining,
      minutesUntilStart: null,
      statusLabel: "CURRENT CLASS",
      countdownText: minutesRemaining === 0 ? "Ending now" : `Ends in ${minutesRemaining} min`,
    }
  }

  // 2. Check if there is an upcoming class today: startMinutes > currentMinutes
  const upcomingClass = todaysClasses.find((item) => item.startMinutes > currentMinutes)

  if (upcomingClass) {
    const minutesUntilStart = Math.max(0, upcomingClass.startMinutes - currentMinutes)
    const isFirstClassOfDay = upcomingClass.id === todaysClasses[0].id

    return {
      state: "next",
      dayName,
      isWeekend: false,
      totalClasses: todaysClasses.length,
      todaysClasses,
      currentClass: null,
      classItem: upcomingClass,
      nextClass: upcomingClass,
      minutesRemaining: null,
      minutesUntilStart,
      statusLabel: "NEXT CLASS",
      isFirstClassOfDay,
      countdownText: minutesUntilStart === 0 ? "Starts now" : `Starts in ${minutesUntilStart} min`,
    }
  }

  // 3. All classes of the day have completed: currentMinutes >= lastClass.endMinutes
  return {
    state: "completed",
    dayName,
    isWeekend: false,
    totalClasses: todaysClasses.length,
    todaysClasses,
    currentClass: null,
    nextClass: null,
    classItem: null,
    minutesRemaining: null,
    minutesUntilStart: null,
    statusLabel: "ALL CLASSES COMPLETE",
    countdownText: `${todaysClasses.length} ${todaysClasses.length === 1 ? "class" : "classes"} scheduled today`,
  }
}
