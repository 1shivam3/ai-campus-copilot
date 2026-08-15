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

# Enable CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


class StudyMaterialRequest(BaseModel):
    subject: str | None = None
    content: str


@app.get("/")
def root():
    return {"message": "AI Campus Copilot backend is running"}


@app.post("/api/study-advice")
def study_advice(request: StudyAdviceRequest):
    prompt = f"""
You are an academic AI copilot.

Student context:

EXAM SUBJECT:
{request.exam_subject}

EXAM DATE:
{request.exam_date}

EXAM IMPORTANCE:
{request.exam_importance}/10

WEAKEST TOPIC:
{request.topic_name}

CURRENT MASTERY:
{request.mastery_score}%

CURRENT TASK:
{request.task_title}

TASK TIME:
{request.task_minutes} minutes

AVAILABLE STUDY TIME:
{request.available_minutes} minutes

Create a practical study strategy.

Return exactly:

WHY NOW:
Explain why this should be prioritized.

ACTION PLAN:
Create a time-blocked plan that fits within the available time.

FIRST TASK:
Give one exact action to begin immediately.

AVOID:
Give one thing the student should not waste time doing.

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
