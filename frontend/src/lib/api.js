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
    throw new Error(errData.detail || "Your document is indexed, but the study pack could not be generated. Please try again.")
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

// ---------------------------------------------------------
// GLOBAL ACADEMIC SEARCH API
// ---------------------------------------------------------

export async function searchAcademicWorkspace({ query, userId, semester, section, limit = 25 }) {
  const response = await fetchWithTimeout(
    `${API_URL}/api/academic-search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.trim(),
        user_id: userId,
        semester: semester ? Number(semester) : null,
        section: section || null,
        limit: Number(limit),
      }),
    },
    15000
  )

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.detail || "Search request failed.")
  }

  return response.json()
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
