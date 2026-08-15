const API_URL =
  import.meta.env.VITE_BACKEND_URL ||
  "https://ai-campus-copilot-uanp.onrender.com"

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
