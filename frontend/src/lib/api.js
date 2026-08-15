const API_URL = "https://ai-campus-copilot-uanp.onrender.com"

export async function generateStudyAdvice(data) {
  const response = await fetch(
    `${API_URL}/api/study-advice`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )

  if (!response.ok) {
    throw new Error("Backend AI request failed.")
  }

  const result = await response.json()

  return result.answer
}

export async function analyzeStudyMaterial(content, subject) {
  const response = await fetch(
    `${API_URL}/api/analyze-material`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, subject }),
    }
  )

  if (!response.ok) {
    throw new Error("Backend material analysis failed.")
  }

  const result = await response.json()

  return result.answer
}

export async function generateTopicQuiz(data) {
  const response = await fetch(
    `${API_URL}/api/generate-quiz`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )

  if (!response.ok) {
    throw new Error("Quiz generation failed.")
  }

  const result = await response.json()

  return result.quiz
}

export async function generateExamQuiz(data) {
  const response = await fetch(
    `${API_URL}/api/generate-exam-quiz`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  )

  if (!response.ok) {
    throw new Error("Exam quiz generation failed.")
  }

  const result = await response.json()

  return result.quiz
}


