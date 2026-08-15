import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured.")

app = FastAPI()

# Enable CORS for Vite frontend (local and deployed on Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://ai-campus-copilot-one.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini SDK
try:
    from google import genai
    client = genai.Client(api_key=api_key)
    USE_NEW_SDK = True
except ImportError:
    import google.generativeai as genai_legacy
    genai_legacy.configure(api_key=api_key)
    USE_NEW_SDK = False


class StudyAdviceRequest(BaseModel):
    exam_subject: str | None = None
    exam_date: str | None = None
    exam_importance: int | None = None
    topic_name: str | None = None
    mastery_score: int | float | None = None
    task_title: str | None = None
    task_minutes: int | None = None
    available_minutes: int = 60
    today: str | None = None
    next_class_subject: str | None = None
    next_class_start: str | None = None
    next_class_end: str | None = None
    recommended_start: str | None = None
    recommended_end: str | None = None
    recommended_minutes: int | None = None


class StudyMaterialRequest(BaseModel):
    subject: str | None = None
    content: str


class QuizRequest(BaseModel):
    topic_name: str
    topic_description: str | None = None


@app.get("/")
def root():
    return {"message": "AI Campus Copilot backend is running"}


@app.post("/api/generate-quiz")
def generate_quiz(request: QuizRequest):
    prompt = f"""
Create a 5-question multiple-choice quiz for a B.Tech Computer Science student.

TOPIC:
{request.topic_name}

DESCRIPTION:
{request.topic_description or "No additional description"}

Rules:
- Questions must test conceptual understanding, problem-solving, and practical knowledge, not trivial memorization.
- Use exactly 4 options per question.
- Exactly one option must be correct (correct_answer is 0-indexed integer: 0, 1, 2, or 3).
- Do not invent information outside the subject domain.
- Return raw JSON only with NO markdown code fences or backticks.

JSON format:
{{
  "questions": [
    {{
      "question": "Clear question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Brief explanation of why this answer is correct."
    }}
  ]
}}
"""

    models_to_try = [
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return {"quiz": response.text}
            else:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return {"quiz": response.text}
        except Exception as err:
            print(f"Model {model_name} failed: {err}")
            last_error = err

    raise HTTPException(
        status_code=500,
        detail=f"Quiz generation failed: {last_error}",
    )



@app.post("/api/study-advice")
def study_advice(request: StudyAdviceRequest):
    prompt = f"""
You are an academic AI campus copilot.

Student context:

TODAY:
{request.today or "Today"}

NEXT SCHEDULED CLASS:
{request.next_class_subject or "No more classes today"} {f"({request.next_class_start} - {request.next_class_end})" if request.next_class_start else ""}

RECOMMENDED FREE STUDY WINDOW:
{f"{request.recommended_start} - {request.recommended_end} ({request.recommended_minutes} mins available)" if request.recommended_start else f"{request.available_minutes} mins available"}

EXAM SUBJECT:
{request.exam_subject or "None upcoming"}

EXAM DATE:
{request.exam_date or "N/A"}

EXAM IMPORTANCE:
{request.exam_importance}/10 if request.exam_importance else "N/A"

WEAKEST TOPIC:
{request.topic_name or "N/A"}

CURRENT MASTERY:
{request.mastery_score}% if request.mastery_score is not None else "N/A"

CURRENT PRIORITY TASK:
{request.task_title or "None"}

TASK TIME:
{request.task_minutes} minutes if request.task_minutes else "N/A"

AVAILABLE STUDY TIME:
{request.recommended_minutes or request.available_minutes} minutes

CRITICAL SCHEDULING INSTRUCTIONS:
- Respect the student's timetable and lecture schedule.
- Do not recommend studying during their upcoming class period.
- If a recommended free study window exists ({request.recommended_start} - {request.recommended_end}), explicitly structure the action plan to fit inside that exact window.
- Do not invent conflicting times.

Create a high-yield study strategy tailored to this exact time slot.

Return exactly:

WHY NOW:
Explain why this task/topic was prioritized and how it fits cleanly into today's class schedule.

ACTION PLAN:
Create a time-blocked action plan that fits directly inside the available study window.

FIRST TASK:
Give one exact action to begin immediately.

AVOID:
Give one specific thing the student should avoid doing during this session.

Do not give generic motivational advice.
"""

    models_to_try = [
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return {"answer": response.text}
            else:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return {"answer": response.text}
        except Exception as err:
            print(f"Model {model_name} failed: {err}")
            last_error = err

    raise HTTPException(
        status_code=500,
        detail=f"AI generation failed: {last_error}",
    )


@app.post("/api/analyze-material")
def analyze_material(request: StudyMaterialRequest):
    trimmed_text = request.content[:30000]

    prompt = f"""
You are an AI academic study assistant.

A student uploaded study material for:

SUBJECT:
{request.subject or "Academic Course"}

DOCUMENT CONTENT:
{trimmed_text}

Analyze the material and return exactly these sections:

SUMMARY:
Give a clear beginner-friendly summary of the most important concepts.

IMPORTANT TOPICS:
List the 5 most important topics from the document.
For each topic, give a one-line explanation.

QUICK REVISION:
Give 8 concise revision points the student should remember.

MCQS:
Create 5 multiple-choice questions based ONLY on the provided document.
For each question:
- Give 4 options
- Identify the correct answer
- Give a one-sentence explanation

Do not invent facts that are not supported by the document.
"""

    models_to_try = [
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return {"answer": response.text}
            else:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return {"answer": response.text}
        except Exception as err:
            print(f"Model {model_name} failed: {err}")
            last_error = err

    raise HTTPException(
        status_code=500,
        detail=f"Material analysis failed: {last_error}",
    )
