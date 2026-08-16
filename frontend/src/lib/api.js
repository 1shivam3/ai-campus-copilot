import { supabase } from "./supabase"

const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000"
    : "https://ai-campus-copilot-uanp.onrender.com")

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    if (error.name === "AbortError") {
      throw new Error("Request timed out. The server may be waking up, please try again.")
    }
    throw error
  }
}

export async function checkBackendHealth() {
  try {
    const res = await fetchWithTimeout(`${API_URL}/health`, { method: "GET" }, 5000)
    if (res.ok) {
      const data = await res.json()
      return data.status === "ok"
    }
  } catch (e) {
    console.warn("Backend health check notice:", e)
  }
  return false
}

export async function generateStudyAdvice(data) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/study-advice`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    60000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "AI strategy generation failed.")
  }

  const result = await response.json()
  return result.answer
}

export async function analyzeStudyMaterial(content, subject) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/analyze-material`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, subject }),
    },
    60000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Study material analysis failed.")
  }

  const result = await response.json()
  return result.answer
}

export async function generateTopicQuiz(data) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/generate-quiz`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    60000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Topic quiz generation failed.")
  }

  const result = await response.json()
  return result.quiz
}

export async function generateExamQuiz(data) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/generate-exam-quiz`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    60000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Exam quiz generation failed.")
  }

  const result = await response.json()
  return result.quiz
}

export async function generateExamQuestion(payload) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/generate-exam-question`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    30000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Exam question generation failed.")
  }

  const result = await response.json()
  return result.question
}

// ---------------------------------------------------------
// GOOGLE CALENDAR API CLIENT METHODS
// ---------------------------------------------------------

export async function fetchCalendarAuthUrl(userId) {
  const redirect = window.location.origin
  const response = await fetchWithTimeout(
    `${API_URL}/api/calendar/auth-url?user_id=${encodeURIComponent(userId)}&redirect_uri=${encodeURIComponent(redirect)}`,
    { method: "GET" },
    15000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(
      errData.detail ||
        errData.message ||
        `Server returned ${response.status}: Could not initialize Google Calendar authorization.`
    )
  }

  return response.json()
}

export async function submitCalendarOAuthCode(code, userId) {
  const redirect = window.location.origin
  const response = await fetchWithTimeout(
    `${API_URL}/api/calendar/oauth-callback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        user_id: userId,
        redirect_uri: redirect,
      }),
    },
    20000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Google Calendar connection failed.")
  }

  return response.json()
}

export async function fetchCalendarStatus(userId) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/calendar/status?user_id=${encodeURIComponent(userId)}`,
    { method: "GET" },
    10000
  )

  if (!response.ok) {
    return { connected: false }
  }

  return response.json()
}

export async function fetchCalendarEvents(userId) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/calendar/events?user_id=${encodeURIComponent(userId)}`,
    { method: "GET" },
    15000
  )

  if (!response.ok) {
    return { connected: false, events: [] }
  }

  return response.json()
}

export async function disconnectCalendarService(userId) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/calendar/disconnect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    },
    15000
  )

  if (!response.ok) {
    throw new Error("Could not disconnect Google Calendar.")
  }

  return response.json()
}

// ---------------------------------------------------------
// STUDY MATERIAL SYLLABUS TOPIC MATCHING API
// ---------------------------------------------------------

export async function matchStudyMaterialTopics(studyMaterialId, userId) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/match-study-material`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
      }),
    },
    30000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Topic matching failed. Please try again.")
  }

  return response.json()
}

// ---------------------------------------------------------
// ASK THIS MATERIAL & DOCUMENT ACTIONS API
// ---------------------------------------------------------

export async function askStudyMaterial({ studyMaterialId, userId, question, actionType = "ask" }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/ask-study-material`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
        question: question || "Explain this document",
        action_type: actionType,
      }),
    },
    35000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Could not generate answer for this study material.")
  }

  return response.json()
}

// ---------------------------------------------------------
// RAG INDEXING API
// ---------------------------------------------------------

export async function indexStudyMaterial({ studyMaterialId, userId }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/index-study-material`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
      }),
    },
    45000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "RAG indexing failed. Please try again.")
  }

  return response.json()
}

// ---------------------------------------------------------
// AI STUDY PACK GENERATION API
// ---------------------------------------------------------

export async function generateStudyPack({ studyMaterialId, userId, forceRegenerate = false }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/generate-study-pack`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
        force_regenerate: forceRegenerate,
      }),
    },
    45000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "The study pack could not be generated right now. Please try again.")
  }

  return response.json()
}

// ---------------------------------------------------------
// AI FLASHCARDS GENERATION & SPACED REPETITION API
// ---------------------------------------------------------

export async function generateFlashcards({ studyMaterialId, userId, count = 15, forceRegenerate = false }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/generate-flashcards`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
        count: Number(count),
        force_regenerate: forceRegenerate,
      }),
    },
    45000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Flashcard generation failed. Please try again.")
  }

  return response.json()
}

export async function reviewFlashcard({ flashcardId, userId, rating }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/review-flashcard`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        flashcard_id: Number(flashcardId),
        user_id: userId,
        rating,
      }),
    },
    15000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Could not save flashcard review rating.")
  }

  return response.json()
}

// ---------------------------------------------------------
// PREVIOUS-YEAR QUESTION PAPER ANALYZER API
// ---------------------------------------------------------

export async function analyzeExamPaper({ studyMaterialId, userId, forceRegenerate = false }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/analyze-exam-paper`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        study_material_id: Number(studyMaterialId),
        user_id: userId,
        force_regenerate: forceRegenerate,
      }),
    },
    50000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "The question paper is safely uploaded, but analysis could not be completed. Please try again.")
  }

  return response.json()
}

function generateSearchTerms(query) {
  const clean = (query || "").trim().toLowerCase()
  if (!clean) return []
  const words = clean.split(/\s+/).filter((w) => w.length > 1)
  const terms = new Set(words)
  terms.add(clean)

  words.forEach((w) => {
    if (w.endsWith("s") && w.length > 3) {
      terms.add(w.slice(0, -1))
    } else if (w.length > 2) {
      terms.add(w + "s")
    }
  })

  // Common academic acronyms
  if (clean.includes("dbms")) {
    terms.add("database")
    terms.add("management")
  }
  if (clean.includes("dsa") || clean.includes("data structure")) {
    terms.add("data structure")
    terms.add("algorithm")
    terms.add("structures")
    terms.add("structure")
  }
  if (words.includes("os") || clean === "os") {
    terms.add("operating")
    terms.add("system")
  }
  if (words.includes("cn") || clean === "cn") {
    terms.add("computer network")
    terms.add("network")
  }
  if (words.includes("oop") || words.includes("java")) {
    terms.add("object oriented")
    terms.add("java")
  }
  if (words.includes("discrete")) {
    terms.add("discrete")
    terms.add("structures")
  }
  if (words.includes("bet") || clean.includes("bet-i")) {
    terms.add("employability")
    terms.add("training")
    terms.add("bet-i")
  }
  if (clean.includes("normalization") || clean.includes("normal")) {
    terms.add("normalization")
    terms.add("normal")
  }

  return Array.from(terms).filter((t) => t.length > 1).slice(0, 8)
}

// ---------------------------------------------------------
// GLOBAL ACADEMIC SEARCH API
// ---------------------------------------------------------

export async function searchAcademicWorkspace({ query, userId, semester, section, limit = 25 }) {
  if (!query || !query.trim()) {
    return { status: "success", query: "", total_results: 0, results: [] }
  }

  const cleanQ = query.trim()

  // 1. Try Backend API
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/api/academic-search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: cleanQ,
          user_id: userId,
          semester: semester ? Number(semester) : null,
          section: section || null,
          limit: Number(limit),
        }),
      },
      8000
    )

    if (response.ok) {
      const data = await response.json()
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return data
      }
    }
  } catch (backendErr) {
    if (import.meta.env.DEV) {
      console.warn("[AcademicSearch] Backend search notice, using client fallback:", backendErr)
    }
  }

  // 2. Resilient Direct Supabase Fallback (Guarantees search always works even if backend is waking up)
  try {
    const searchTerms = generateSearchTerms(cleanQ)
    const fallbackResults = []

    // A. Academic Subjects
    const subFilter = searchTerms.map((t) => `subject_name.ilike.%${t}%,subject_code.ilike.%${t}%`).join(",")
    const { data: subData } = await supabase
      .from("academic_subjects")
      .select("id, subject_name, subject_code, semester, section")
      .or(subFilter)
      .limit(6)

    if (subData && subData.length > 0) {
      subData.forEach((s) => {
        fallbackResults.push({
          type: "syllabus",
          title: `${s.subject_name} (${s.subject_code})`,
          subtitle: `Semester ${s.semester} · Course Curriculum`,
          score: 0.95,
          metadata: { subject_id: s.id, subject_name: s.subject_name, subject_code: s.subject_code },
        })
      })
    }

    // B. Syllabus Topics
    const topFilter = searchTerms.map((t) => `topic_name.ilike.%${t}%,description.ilike.%${t}%`).join(",")
    let topicQuery = supabase
      .from("syllabus_topics")
      .select("id, topic_name, unit_number, description, subject_id, academic_subjects!inner(id, subject_name, subject_code, semester)")
      .or(topFilter)
      .limit(8)

    if (semester) {
      topicQuery = topicQuery.eq("academic_subjects.semester", semester)
    }
    const { data: topData } = await topicQuery

    if (topData && topData.length > 0) {
      topData.forEach((t) => {
        const sub = t.academic_subjects || {}
        const subName = sub.subject_name || "Subject"
        const subCode = sub.subject_code ? ` (${sub.subject_code})` : ""
        const unitStr = t.unit_number ? `Unit ${t.unit_number}` : "Syllabus"

        fallbackResults.push({
          type: "syllabus",
          title: t.topic_name || "Topic",
          subtitle: `${subName}${subCode} · ${unitStr}`,
          score: 0.90,
          metadata: {
            topic_id: t.id,
            subject_id: t.subject_id,
            subject_name: subName,
            unit_number: t.unit_number,
          },
        })
      })
    }

    // C. User Tasks
    if (userId) {
      const taskFilter = searchTerms.map((t) => `title.ilike.%${t}%,subject.ilike.%${t}%`).join(",")
      const { data: taskData } = await supabase
        .from("tasks")
        .select("id, title, subject, deadline, importance, status")
        .eq("user_id", userId)
        .or(taskFilter)
        .limit(5)

      if (taskData && taskData.length > 0) {
        taskData.forEach((t) => {
          fallbackResults.push({
            type: "task",
            title: t.title || "Task",
            subtitle: `${t.subject || "General"} · Priority: ${t.importance || "Normal"}`,
            score: 0.85,
            metadata: { id: t.id, task_id: t.id, subject: t.subject },
          })
        })
      }

      // D. User Exams
      const examFilter = searchTerms.map((t) => `subject.ilike.%${t}%`).join(",")
      const { data: examData } = await supabase
        .from("exams")
        .select("id, subject, exam_date, importance")
        .eq("user_id", userId)
        .or(examFilter)
        .limit(4)

      if (examData && examData.length > 0) {
        examData.forEach((ex) => {
          fallbackResults.push({
            type: "exam",
            title: `${ex.subject} Examination`,
            subtitle: `Importance: ${ex.importance || 5}/10`,
            score: 0.88,
            metadata: { id: ex.id, exam_id: ex.id, subject: ex.subject },
          })
        })
      }

      // E. User Study Materials
      const matFilter = searchTerms.map((t) => `title.ilike.%${t}%`).join(",")
      const { data: matData } = await supabase
        .from("study_materials")
        .select("id, title, material_type, unit_number, academic_subjects(subject_name, subject_code)")
        .eq("user_id", userId)
        .or(matFilter)
        .limit(6)

      if (matData && matData.length > 0) {
        matData.forEach((m) => {
          const sub = m.academic_subjects || {}
          const isPaper = m.material_type === "Previous Year Paper"
          fallbackResults.push({
            type: isPaper ? "previous_paper" : "study_material",
            title: m.title || "Document",
            subtitle: `${sub.subject_name || "Course Notes"} · ${m.material_type || "Study Material"}`,
            score: 0.92,
            metadata: { id: m.id, material_id: m.id, material_type: m.material_type },
          })
        })
      }
    }

    // Deduplicate
    const seen = new Set()
    const unique = []
    for (const item of fallbackResults) {
      const key = `${item.type}:${item.title}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(item)
      }
    }

    return {
      status: "success",
      query: cleanQ,
      total_results: unique.length,
      results: unique,
    }
  } catch (fbErr) {
    if (import.meta.env.DEV) {
      console.error("[AcademicSearch] Fallback error:", fbErr)
    }
    return {
      status: "success",
      query: cleanQ,
      total_results: 0,
      results: [],
    }
  }
}

export async function sendCopilotMessage({ message, userId, conversationId = null }) {
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/api/copilot-chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message.trim(),
          user_id: userId,
          conversation_id: conversationId ? Number(conversationId) : null,
        }),
      },
      45000
    )

    if (response.ok) {
      return await response.json()
    }

    // Graceful fallback if backend instance is deploying or returns 404
    if (response.status === 404) {
      console.warn("Copilot chat route 404, using fallback study advice pipeline...")
      try {
        const fallbackAdvice = await generateStudyAdvice({
          today: new Date().toLocaleDateString("en-US", { weekday: "long" }),
          topic_name: message.trim(),
          user_id: userId,
        })

        const answerText = typeof fallbackAdvice === "string" ? fallbackAdvice : (fallbackAdvice?.answer || fallbackAdvice?.message)

        if (answerText) {
          return {
            status: "success",
            conversation_id: conversationId,
            message: answerText,
            actions: [
              { type: "start_focus", label: "Start 45m Focus Session", minutes: 45 },
              { type: "open_timetable", label: "View Timetable" },
            ],
            sources: [],
          }
        }
      } catch (fbErr) {
        console.warn("Fallback study advice error:", fbErr)
      }
    }

    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Copilot message failed. Please try again.")
  } catch (err) {
    // If local dev server is running on port 8000, attempt direct local call
    if (typeof window !== "undefined" && window.location.hostname === "localhost" && !API_URL.includes("localhost:8000")) {
      try {
        const localResp = await fetch("http://localhost:8000/api/copilot-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message.trim(),
            user_id: userId,
            conversation_id: conversationId ? Number(conversationId) : null,
          }),
        })
        if (localResp.ok) {
          return await localResp.json()
        }
      } catch (locErr) {
        console.warn("Local backend fallback attempt notice:", locErr)
      }
    }
    throw err
  }
}

export async function fetchUserStats(userId) {
  if (!userId) return null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/user-stats/${userId}`,
        { method: "GET" },
        25000
      )
      if (response.ok) {
        const data = await response.json()
        return data.stats || null
      }
    } catch (err) {
      if (attempt === 1) console.warn("User stats fetch notice:", err)
    }
  }
  return null
}

export async function syncUserLearningStats(stats) {
  if (!stats?.user_id) return null
  try {
    const response = await fetchWithTimeout(
      `${API_URL}/api/sync-user-stats`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
      },
      25000
    )
    if (response.ok) {
      return await response.json()
    }
  } catch (err) {
    console.warn("Campus stats sync notice:", err)
  }
  return null
}

export async function fetchCampusLeaderboard(timeframe = "global") {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/leaderboard?timeframe=${timeframe}`,
        { method: "GET" },
        25000
      )
      if (response.ok) {
        const data = await response.json()
        return data.leaderboard || []
      }
    } catch (err) {
      if (attempt === 1) console.warn("Campus leaderboard fetch notice:", err)
    }
  }
  return []
}
