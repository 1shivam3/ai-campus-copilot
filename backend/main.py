import json
import logging
import os
import re
import sys
import urllib.parse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.embeddings import embed_text, embed_query, embed_batch
from services.chunking import chunk_document_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("coursepilot.calendar")

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
google_redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "")

# Initialize Supabase client for backend database operations
supabase_url = os.getenv("VITE_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client | None = None
if supabase_url and supabase_key:
    try:
        supabase_client = create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.warning(f"Could not initialize Supabase backend client: {e}")

# In-memory secure token store for calendar OAuth (user_id -> tokens)
calendar_token_store = {}

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured.")

app = FastAPI(title="CoursePilot API", docs_url=None, redoc_url=None)

# Enable CORS for Vite frontend (local, preview, and production Vercel domains)
frontend_env_url = os.getenv("FRONTEND_URL")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:3000",
    "https://ai-campus-copilot-one.vercel.app",
    "https://ai-campus-copilot.vercel.app",
]
if frontend_env_url and frontend_env_url not in allowed_origins:
    allowed_origins.append(frontend_env_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


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
    content: str = Field(..., max_length=100000)


class QuizRequest(BaseModel):
    topic_name: str = Field(..., min_length=1, max_length=200)
    topic_description: str | None = Field(None, max_length=1000)


class ExamQuizQuestion(BaseModel):
    topic_name: str = Field(..., min_length=1, max_length=200)
    mastery_score: int | float = Field(0, ge=0, le=100)


class ExamQuizRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    topics: list[ExamQuizQuestion] = Field(default_factory=list)
    question_count: int = Field(10, ge=1, le=20)


@app.get("/")
def root():
    return {"message": "CoursePilot backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/generate-exam-quiz")
def generate_exam_quiz(request: ExamQuizRequest):
    if not request.subject.strip():
        raise HTTPException(status_code=400, detail="Subject name is required.")

    topics_text = "\n".join(
        f"- {topic.topic_name}: {topic.mastery_score}% mastery"
        for topic in request.topics
    ) if request.topics else f"- {request.subject} Core Topics: 50% mastery"

    prompt = f"""
You are creating an adaptive exam-practice quiz for a B.Tech Computer Science student using CoursePilot.

SUBJECT:
{request.subject}

TOPICS AND STUDENT MASTERY:
{topics_text}

Create exactly {request.question_count} multiple-choice questions.

IMPORTANT RULES:
- Prioritize topics with lower mastery score (weak topics should receive more questions).
- Cover multiple syllabus topics.
- Questions should test understanding, problem-solving, and application.
- Use exactly 4 options per question.
- Exactly one option is correct (correct_answer is 0-indexed integer: 0, 1, 2, or 3).
- Do not invent topics outside the provided list.
- Return raw JSON only with NO markdown code fences or backticks.

JSON format:
{{
  "questions": [
    {{
      "topic": "Exact topic name",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Why this answer is correct."
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
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="Exam quiz generation is currently unavailable. Please try again in a few moments.",
    )


@app.post("/api/generate-quiz")
def generate_quiz(request: QuizRequest):
    if not request.topic_name.strip():
        raise HTTPException(status_code=400, detail="Topic name is required.")

    prompt = f"""
Create a 5-question multiple-choice quiz for a B.Tech Computer Science student using CoursePilot.

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
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="Topic quiz generation is currently unavailable. Please try again in a few moments.",
    )


@app.post("/api/study-advice")
def study_advice(request: StudyAdviceRequest):
    exam_importance_str = f"{request.exam_importance}/10" if request.exam_importance else "N/A"
    mastery_score_str = f"{request.mastery_score}%" if request.mastery_score is not None else "N/A"
    task_minutes_str = f"{request.task_minutes} minutes" if request.task_minutes else "N/A"

    prompt = f"""
You are CoursePilot, an academic AI study co-pilot for university students.

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
{exam_importance_str}

WEAKEST TOPIC:
{request.topic_name or "N/A"}

CURRENT MASTERY:
{mastery_score_str}

CURRENT PRIORITY TASK:
{request.task_title or "None"}

TASK TIME:
{task_minutes_str}

AVAILABLE STUDY TIME:
{request.recommended_minutes or request.available_minutes} minutes

CRITICAL SCHEDULING & TOPIC INSTRUCTIONS:
- Prioritize the student's highest-risk / weakest syllabus topics first ({request.topic_name or "Core Topics"}).
- Do not spend most of the available time on topics where mastery is already high; allocate time heavily to the weakest areas.
- Respect the student's timetable and lecture schedule.
- Do not recommend studying during their upcoming class period.
- If a recommended free study window exists ({request.recommended_start} - {request.recommended_end}), explicitly structure the action plan to fit inside that exact window.
- Do not invent conflicting times.

Create a high-yield study strategy tailored to this exact time slot and these specific priority topics.

Return exactly:

WHY NOW:
Explain why these specific topics/tasks were prioritized and how this session fits cleanly into today's class schedule.

ACTION PLAN:
Create a time-blocked action plan that directly targets the highest-risk topics inside the available study window.

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
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="AI study strategy generation is currently unavailable. Please try again in a moment.",
    )


@app.post("/api/analyze-material")
def analyze_material(request: StudyMaterialRequest):
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="Document content cannot be empty.")

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
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="Document analysis is currently unavailable. Please try again in a moment.",
    )


# ---------------------------------------------------------
# GOOGLE CALENDAR INTEGRATION ENDPOINTS
# ---------------------------------------------------------

class CalendarCallbackRequest(BaseModel):
    code: str
    user_id: str
    redirect_uri: str | None = None


class CalendarDisconnectRequest(BaseModel):
    user_id: str


@app.get("/api/calendar/auth-url")
def get_calendar_auth_url(user_id: str = Query(...), redirect_uri: str | None = None):
    """
    Generates a secure Google OAuth 2.0 authorization URL requesting
    minimal read-only Calendar permissions.
    """
    logger.info(f"[CALENDAR_OAUTH] auth-url endpoint reached for user={user_id[:8]}...")
    client_id = google_client_id

    if not client_id:
        logger.warning("[CALENDAR_OAUTH] GOOGLE_CLIENT_ID is not configured in backend environment variables.")
        return {
            "configured": False,
            "auth_url": None,
            "message": "Google Calendar OAuth client credentials are not configured on the backend. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the Render environment settings.",
        }

    redirect = redirect_uri or google_redirect_uri or "https://ai-campus-copilot-one.vercel.app"
    scope = "https://www.googleapis.com/auth/calendar.events.readonly"

    params = {
        "client_id": client_id,
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "state": user_id,
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    logger.info(f"[CALENDAR_OAUTH] Generated Google OAuth URL with redirect_uri={redirect} and scope={scope}")
    return {
        "configured": True,
        "auth_url": auth_url,
    }


@app.post("/api/calendar/oauth-callback")
async def calendar_oauth_callback(request: CalendarCallbackRequest):
    """
    Exchanges Google authorization code for access & refresh tokens.
    Stores tokens securely on backend memory/store and returns connection status.
    """
    logger.info(f"[CALENDAR_OAUTH] oauth-callback endpoint reached for user={request.user_id[:8]}...")
    if not google_client_id or not google_client_secret:
        logger.error("[CALENDAR_OAUTH] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on server.")
        raise HTTPException(
            status_code=400,
            detail="Google Calendar credentials (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET) are not configured on the backend.",
        )

    redirect = request.redirect_uri or google_redirect_uri or "https://ai-campus-copilot-one.vercel.app"

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": request.code,
        "client_id": google_client_id,
        "client_secret": google_client_secret,
        "redirect_uri": redirect,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            token_res = await http_client.post(token_url, data=payload)
            if not token_res.is_success:
                logger.error(f"[CALENDAR_OAUTH_ERROR] Token exchange failed with status {token_res.status_code}")
                raise HTTPException(
                    status_code=400,
                    detail="Google token exchange failed. The authorization code may be invalid or expired.",
                )

            token_data = token_res.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 3600)

            # Retrieve connected Google user profile email
            userinfo_res = await http_client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            email = userinfo_res.json().get("email") if userinfo_res.is_success else "Google User"
            logger.info(f"[CALENDAR_OAUTH] Successfully authorized calendar connection for account {email}")

            # Store tokens securely on the server
            calendar_token_store[request.user_id] = {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "email": email,
                "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat(),
                "last_synced": datetime.now(timezone.utc).isoformat(),
            }

            return {
                "status": "connected",
                "email": email,
                "last_synced": calendar_token_store[request.user_id]["last_synced"],
            }
    except Exception as err:
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(status_code=500, detail=f"OAuth callback error: {str(err)}")


@app.get("/api/calendar/status")
def get_calendar_status(user_id: str = Query(...)):
    """
    Returns calendar connection status for the authenticated student.
    Never exposes tokens or secrets.
    """
    connection = calendar_token_store.get(user_id)
    if not connection:
        return {
            "connected": False,
            "email": None,
            "last_synced": None,
            "is_oauth_configured": bool(google_client_id and google_client_secret),
        }

    return {
        "connected": True,
        "email": connection.get("email"),
        "last_synced": connection.get("last_synced"),
        "is_oauth_configured": True,
    }


@app.get("/api/calendar/events")
async def get_calendar_events(user_id: str = Query(...)):
    """
    Fetches calendar events for today from the Google Calendar API,
    ignoring cancelled events and extracting only time blocks to derive availability.
    """
    connection = calendar_token_store.get(user_id)
    if not connection:
        return {
            "connected": False,
            "events": [],
            "message": "Google Calendar is not connected.",
        }

    access_token = connection.get("access_token")
    if not access_token:
        return {"connected": False, "events": []}

    now = datetime.now(timezone.utc)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end_of_day = (now + timedelta(days=1)).replace(hour=23, minute=59, second=59).isoformat()

    events_url = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    params = {
        "timeMin": start_of_day,
        "timeMax": end_of_day,
        "singleEvents": "true",
        "orderBy": "startTime",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            res = await http_client.get(
                events_url,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
            )

            if res.status_code == 401 and connection.get("refresh_token") and google_client_id and google_client_secret:
                # Refresh token flow
                refresh_res = await http_client.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": google_client_id,
                        "client_secret": google_client_secret,
                        "refresh_token": connection["refresh_token"],
                        "grant_type": "refresh_token",
                    },
                )
                if refresh_res.is_success:
                    new_token = refresh_res.json().get("access_token")
                    connection["access_token"] = new_token
                    res = await http_client.get(
                        events_url,
                        headers={"Authorization": f"Bearer {new_token}"},
                        params=params,
                    )

            if not res.is_success:
                return {
                    "connected": True,
                    "events": [],
                    "error": "Could not fetch calendar events from Google API.",
                }

            items = res.json().get("items", [])
            sanitized_events = []

            for item in items:
                if item.get("status") == "cancelled":
                    continue

                sanitized_events.append({
                    "id": item.get("id"),
                    "summary": item.get("summary", "Busy Event"),
                    "start": item.get("start", {}),
                    "end": item.get("end", {}),
                    "status": item.get("status", "confirmed"),
                })

            connection["last_synced"] = datetime.now(timezone.utc).isoformat()

            return {
                "connected": True,
                "events": sanitized_events,
                "last_synced": connection["last_synced"],
            }
    except Exception as err:
        return {
            "connected": True,
            "events": [],
            "error": f"Calendar sync failed: {str(err)}",
        }


@app.post("/api/calendar/disconnect")
async def disconnect_calendar(request: CalendarDisconnectRequest):
    """
    Safely disconnects Google Calendar and removes stored credentials.
    Preserves all existing CoursePilot student tasks and academic data.
    """
    connection = calendar_token_store.pop(request.user_id, None)

    if connection and connection.get("access_token"):
        # Optionally revoke token with Google
        try:
            async with httpx.AsyncClient(timeout=5.0) as http_client:
                await http_client.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": connection["access_token"]},
                )
        except Exception:
            pass

    return {
        "status": "disconnected",
        "message": "Google Calendar has been disconnected.",
    }


# ---------------------------------------------------------
# STUDY MATERIAL SYLLABUS TOPIC MATCHING ENDPOINT
# ---------------------------------------------------------

class MatchStudyMaterialRequest(BaseModel):
    study_material_id: int
    user_id: str


@app.post("/api/match-study-material")
async def match_study_material(request: MatchStudyMaterialRequest):
    """
    Analyzes study material extracted text using Gemini AI and matches it
    against syllabus topics belonging to the material's specific subject and unit.
    Persists matches with match_score >= 60 in study_material_topics table.
    """
    logger.info(f"[TOPIC_MATCH] Request received for material_id={request.study_material_id}, user={request.user_id[:8]}...")

    if not supabase_client:
        logger.error("[TOPIC_MATCH] Supabase client is not configured on the backend.")
        raise HTTPException(
            status_code=500,
            detail="Database client is not configured on the backend.",
        )

    # 1. Fetch study material and verify ownership
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[TOPIC_MATCH] Error querying study_materials: {err}")
        raise HTTPException(
            status_code=500,
            detail="Could not access study material from database.",
        )

    if not mat_res.data:
        raise HTTPException(
            status_code=404,
            detail="Study material record not found.",
        )

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(
            status_code=403,
            detail="Access denied. You do not own this study material.",
        )

    extracted_text = material.get("extracted_text") or ""
    if not extracted_text.strip():
        return {
            "status": "failed",
            "message": "No readable extracted text in document to perform topic matching.",
            "matches": [],
            "matched_count": 0,
        }

    # 2. Retrieve syllabus topics for this subject and unit
    subject_id = material.get("subject_id")
    unit_number = material.get("unit_number")

    topics = []
    try:
        if subject_id and unit_number:
            res = supabase_client.table("syllabus_topics").select(
                "id, topic_name, description, unit_number"
            ).eq("subject_id", subject_id).eq("unit_number", unit_number).execute()
            topics = res.data or []

        if not topics and subject_id:
            res = supabase_client.table("syllabus_topics").select(
                "id, topic_name, description, unit_number"
            ).eq("subject_id", subject_id).execute()
            topics = res.data or []
    except Exception as err:
        logger.error(f"[TOPIC_MATCH] Error fetching syllabus_topics: {err}")
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve syllabus topics for matching.",
        )

    if not topics:
        return {
            "status": "matched",
            "message": "No syllabus topics found for this subject and unit.",
            "matches": [],
            "matched_count": 0,
        }

    # 3. Normalize and truncate document text
    clean_text = re.sub(r"\s+", " ", extracted_text).strip()
    truncated_text = clean_text[:12000]

    topics_payload = [
        {"syllabus_topic_id": t["id"], "topic_name": t["topic_name"]}
        for t in topics
    ]

    prompt = f"""
You are an expert academic curriculum analyzer for CoursePilot.
Analyze the student study material text and identify which of the provided syllabus topics it covers.

AVAILABLE SYLLABUS TOPICS:
{json.dumps(topics_payload, indent=2)}

STUDY MATERIAL TEXT (TRUNCATED):
\"\"\"{truncated_text}\"\"\"

STRICT MATCHING RULES:
1. Match ONLY against the provided syllabus topics list above.
2. Do NOT invent, hallucinate, or rename any syllabus topics.
3. Match based on semantic and conceptual overlap between the document text and each topic.
4. A document can match multiple topics.
5. Assign a match_score from 0 to 100 for each topic (use >=80 for strong coverage, 60-79 for moderate/partial coverage).
6. Only return topics that have real evidence in the text.
7. Return strictly valid JSON with no markdown formatting or backticks.

REQUIRED JSON STRUCTURE:
{{
  "matches": [
    {{
      "syllabus_topic_id": 123,
      "match_score": 94
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

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[TOPIC_MATCH] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="AI topic matching service is temporarily unavailable. Please try again.",
        )

    # 4. Parse JSON matches safely
    raw_matches = []
    try:
        clean_json_str = response_text.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.startswith("```"):
            clean_json_str = clean_json_str[3:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        clean_json_str = clean_json_str.strip()

        parsed_data = json.loads(clean_json_str)
        raw_matches = parsed_data.get("matches", [])
    except Exception as parse_err:
        logger.warning(f"[TOPIC_MATCH] JSON parse warning: {parse_err}, raw: {response_text[:200]}")

    # 5. Filter matches with threshold score >= 60
    valid_topic_map = {t["id"]: t["topic_name"] for t in topics}
    filtered_matches = []

    for m in raw_matches:
        t_id = m.get("syllabus_topic_id")
        try:
            score = float(m.get("match_score", 0))
        except (ValueError, TypeError):
            continue

        if t_id in valid_topic_map and score >= 60:
            filtered_matches.append({
                "study_material_id": request.study_material_id,
                "syllabus_topic_id": t_id,
                "topic_name": valid_topic_map[t_id],
                "match_score": round(score, 1),
            })

    filtered_matches.sort(key=lambda x: x["match_score"], reverse=True)

    # 6. Persist matches in study_material_topics table
    try:
        supabase_client.table("study_material_topics").delete().eq(
            "study_material_id", request.study_material_id
        ).execute()

        if filtered_matches:
            db_records = [
                {
                    "study_material_id": m["study_material_id"],
                    "syllabus_topic_id": m["syllabus_topic_id"],
                    "match_score": m["match_score"],
                }
                for m in filtered_matches
            ]
            supabase_client.table("study_material_topics").insert(db_records).execute()
    except Exception as persist_err:
        logger.warning(f"[TOPIC_MATCH] Notice: Could not persist to study_material_topics: {persist_err}")

    logger.info(f"[TOPIC_MATCH] Successfully matched {len(filtered_matches)} topics for material_id={request.study_material_id}")

    return {
        "status": "matched",
        "matches": filtered_matches,
        "matched_count": len(filtered_matches),
    }


# ---------------------------------------------------------
# RAG INDEXING & SEMANTIC RETRIEVAL ENDPOINTS
# ---------------------------------------------------------

class IndexStudyMaterialRequest(BaseModel):
    study_material_id: int
    user_id: str


@app.post("/api/index-study-material")
async def index_study_material(request: IndexStudyMaterialRequest):
    """
    RAG Chunking and Vector Embedding Pipeline.
    Chunks document text (~600-900 tokens with overlap), computes 768-dim embeddings,
    and stores them in study_material_chunks for high-speed semantic search.
    """
    logger.info(f"[RAG_INDEX] Indexing material_id={request.study_material_id}, user={request.user_id[:8]}...")

    if not supabase_client:
        raise HTTPException(
            status_code=500,
            detail="Database client is not configured on the backend.",
        )

    # 1. Verify ownership and retrieve extracted text
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[RAG_INDEX] Query error: {err}")
        raise HTTPException(status_code=500, detail="Could not access study material.")

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="Study material not found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(status_code=403, detail="Access denied. You do not own this study material.")

    extracted_text = material.get("extracted_text") or ""
    if not extracted_text.strip():
        # Update status to failed
        supabase_client.table("study_materials").update({"processing_status": "failed"}).eq("id", request.study_material_id).execute()
        return {
            "status": "failed",
            "chunks_created": 0,
            "message": "No extracted text available to index.",
            "study_material_id": request.study_material_id,
        }

    # 2. Update status to 'embedding'
    try:
        supabase_client.table("study_materials").update({"processing_status": "embedding"}).eq("id", request.study_material_id).execute()
    except Exception:
        pass

    # 3. Chunk text into semantic passages
    raw_chunks = chunk_document_text(extracted_text, target_chunk_size=2400, chunk_overlap=400)
    if not raw_chunks:
        raw_chunks = [{
            "chunk_index": 0,
            "content": extracted_text[:2400],
            "page_number": 1,
            "token_count": len(extracted_text[:2400]) // 4,
        }]

    # 4. Generate embeddings with batch pacing
    chunk_texts = [c["content"] for c in raw_chunks]
    embeddings = embed_batch(chunk_texts)

    # 5. Delete existing chunks for this material (clean re-index)
    try:
        supabase_client.table("study_material_chunks").delete().eq(
            "study_material_id", request.study_material_id
        ).execute()
    except Exception as del_err:
        logger.warning(f"[RAG_INDEX] Delete stale chunks warning: {del_err}")

    # 6. Insert new chunks with vector embeddings
    db_records = []
    for chunk_meta, emb in zip(raw_chunks, embeddings):
        if emb and len(emb) == 768:
            db_records.append({
                "study_material_id": request.study_material_id,
                "chunk_index": chunk_meta["chunk_index"],
                "content": chunk_meta["content"],
                "embedding": emb,
                "page_number": chunk_meta.get("page_number", 1),
                "token_count": chunk_meta.get("token_count", 0),
            })

    try:
        if db_records:
            supabase_client.table("study_material_chunks").insert(db_records).execute()

        # Update status to 'processed'
        supabase_client.table("study_materials").update({"processing_status": "processed"}).eq("id", request.study_material_id).execute()
        logger.info(f"[RAG_INDEX] Successfully indexed {len(db_records)} chunks for material_id={request.study_material_id}")
    except Exception as insert_err:
        logger.error(f"[RAG_INDEX] Insert chunks error: {insert_err}")
        supabase_client.table("study_materials").update({"processing_status": "failed"}).eq("id", request.study_material_id).execute()
        raise HTTPException(status_code=500, detail=f"Failed to store document vector chunks: {insert_err}")

    return {
        "status": "processed",
        "chunks_created": len(db_records),
        "study_material_id": request.study_material_id,
    }


# ---------------------------------------------------------
# ASK THIS MATERIAL & DOCUMENT ACTIONS ENDPOINT (RAG ENABLED)
# ---------------------------------------------------------

class AskStudyMaterialRequest(BaseModel):
    study_material_id: int
    user_id: str
    question: str = Field(..., min_length=1, max_length=2000)
    action_type: str = Field("ask", max_length=50)


@app.post("/api/ask-study-material")
async def ask_study_material(request: AskStudyMaterialRequest):
    """
    RAG-powered AI Document Assistant.
    Retrieves top relevant chunks via vector similarity search and answers
    strictly grounded in the student's uploaded study material.
    """
    logger.info(f"[RAG_QUERY] Action={request.action_type}, material_id={request.study_material_id}, user={request.user_id[:8]}...")

    if not supabase_client:
        logger.error("[RAG_QUERY] Supabase client is not configured on the backend.")
        raise HTTPException(
            status_code=500,
            detail="Database client is not configured on the backend.",
        )

    # 1. Fetch study material and verify ownership
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[RAG_QUERY] Error querying study_materials: {err}")
        raise HTTPException(
            status_code=500,
            detail="Could not access study material from database.",
        )

    if not mat_res.data:
        raise HTTPException(
            status_code=404,
            detail="Study material record not found.",
        )

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(
            status_code=403,
            detail="Access denied. You do not own this study material.",
        )

    extracted_text = material.get("extracted_text") or ""
    if not extracted_text.strip():
        return {
            "status": "empty_text",
            "answer": "This study document does not contain readable extracted text. Please make sure you upload a text-based PDF.",
            "action_type": request.action_type,
            "source_title": material.get("title", "Study Material"),
            "sources": [],
            "confidence": "weak",
        }

    # 2. Retrieve Subject Name
    subject_name = "Academic Course"
    if material.get("subject_id"):
        try:
            sub_res = supabase_client.table("academic_subjects").select("subject_name, subject_code").eq("id", material["subject_id"]).maybe_single().execute()
            if sub_res.data:
                code_str = f" ({sub_res.data['subject_code']})" if sub_res.data.get("subject_code") else ""
                subject_name = f"{sub_res.data['subject_name']}{code_str}"
        except Exception:
            pass

    # 3. Retrieve Matched Syllabus Topics
    matched_topics_str = "None identified"
    try:
        topics_res = supabase_client.table("study_material_topics").select(
            "match_score, syllabus_topics (topic_name)"
        ).eq("study_material_id", request.study_material_id).execute()

        if topics_res.data:
            topic_names = [
                f"{t['syllabus_topics']['topic_name']} ({int(t['match_score'])}%)"
                for t in topics_res.data
                if t.get("syllabus_topics")
            ]
            if topic_names:
                matched_topics_str = ", ".join(topic_names)
    except Exception:
        pass

    title = material.get("title", "Study Material")
    unit_str = f"Unit {material.get('unit_number')}" if material.get("unit_number") else "General Unit"

    # 4. RAG VECTOR RETRIEVAL (For Q&A and Explain Simply)
    retrieved_sources = []
    confidence = "moderate"
    retrieved_context = ""

    if request.action_type in ["ask", "explain_simply"]:
        query_vector = embed_query(request.question)
        retrieved_chunks = []

        if query_vector and len(query_vector) == 768:
            try:
                rpc_res = supabase_client.rpc(
                    "match_study_material_chunks",
                    {
                        "query_embedding": query_vector,
                        "match_threshold": 0.25,
                        "match_count": 5,
                        "target_study_material_id": request.study_material_id,
                    }
                ).execute()
                retrieved_chunks = rpc_res.data or []
            except Exception as rpc_err:
                logger.warning(f"[RAG_QUERY] RPC similarity search notice: {rpc_err}")

        # Fallback to direct chunk query if RPC function is not yet enabled
        if not retrieved_chunks:
            try:
                chunk_res = supabase_client.table("study_material_chunks").select(
                    "id, chunk_index, content, page_number"
                ).eq("study_material_id", request.study_material_id).limit(5).execute()
                retrieved_chunks = chunk_res.data or []
            except Exception:
                pass

        if retrieved_chunks:
            passage_blocks = []
            max_sim = 0.0

            for i, c in enumerate(retrieved_chunks):
                sim = float(c.get("similarity", 0.70))
                max_sim = max(max_sim, sim)
                page_num = c.get("page_number") or 1
                passage_blocks.append(
                    f"--- PASSAGE {i+1} (Page {page_num}, Relevance {int(sim*100)}%) ---\n{c.get('content', '')}"
                )
                retrieved_sources.append({
                    "chunk_id": c.get("id"),
                    "page_number": page_num,
                    "similarity": round(sim, 2),
                    "content_preview": (c.get("content", "")[:120] + "...").replace("\n", " "),
                })

            retrieved_context = "\n\n".join(passage_blocks)
            confidence = "strong" if max_sim >= 0.75 else ("moderate" if max_sim >= 0.50 else "weak")
        else:
            # Fallback to clean document text
            clean_text = re.sub(r"\s+", " ", extracted_text).strip()
            retrieved_context = clean_text[:12000]
            confidence = "weak"
    else:
        # For Summarize / Important Points / Quiz, use synthesized document context
        clean_text = re.sub(r"\s+", " ", extracted_text).strip()
        retrieved_context = clean_text[:15000]

    # 5. Build prompt based on action_type
    if request.action_type == "summarize":
        prompt = f"""
You are CoursePilot, an academic AI study co-pilot for university engineering students.
Generate a comprehensive, beautifully structured revision summary derived from the provided study document.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}
MATCHED SYLLABUS TOPICS: {matched_topics_str}

DOCUMENT TEXT:
\"\"\"{retrieved_context}\"\"\"

FORMAT YOUR SUMMARY USING THESE EXACT MARKDOWN HEADINGS:
### 📌 Executive Overview
(2-3 clear sentences summarizing the core focus and purpose of this document)

### 🔑 Key Concepts Covered
(Structured bullet points explaining the primary mechanisms and theoretical concepts)

### 📖 Important Definitions & Formulae
(Key definitions, terminology, mathematical expressions, or time/space complexities from the notes)

### 💡 Illustrative Examples & Code
(Concrete code snippets, algorithm steps, or practical examples mentioned in the material)

### 🎯 High-Yield Exam Takeaways
(Top 4-5 critical points a student must memorize or review before the exam)
"""

    elif request.action_type == "important_points":
        prompt = f"""
You are CoursePilot, an academic AI study co-pilot for university students.
Extract the most critical, high-yield examination points from the provided study material.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}
MATCHED TOPICS: {matched_topics_str}

DOCUMENT TEXT:
\"\"\"{retrieved_context}\"\"\"

FORMAT YOUR RESPONSE USING THESE EXACT MARKDOWN HEADINGS:
### 🌟 Foundational Concepts
(The core theoretical pillars that anchor this topic)

### 📌 High-Yield Definitions & Viva Questions
(Crucial definitions, acronyms, and standard 2-mark university questions)

### ⚠️ Common Confusions & Student Pitfalls
(Subtle distinctions and frequent misconceptions, e.g. recursion vs iteration, singly vs doubly linked lists)

### 📝 Probable Exam Questions
(Likely long-form questions, derivations, or comparison tables to prepare)
"""

    elif request.action_type == "explain_simply":
        prompt = f"""
You are CoursePilot, a patient, empathetic university professor.
Explain the following concept using the retrieved document passages in plain, intuitive language with a memorable analogy.

DOCUMENT: {title}
SUBJECT: {subject_name}
CONCEPT / TEXT TO EXPLAIN:
"{request.question}"

RETRIEVED PASSAGES FROM DOCUMENT:
\"\"\"{retrieved_context}\"\"\"

RULES:
1. Explain in simple, conversational English without unnecessary jargon.
2. Use a relatable real-world analogy to make the intuition stick.
3. Break the mechanism into 3-4 simple numbered steps.
4. Conclude with a single bold "💡 Key Rule of Thumb".
"""

    elif request.action_type == "quiz":
        prompt = f"""
You are an academic examination generator for CoursePilot.
Generate exactly 5 multiple choice practice questions derived strictly from the concepts and facts in this study material.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}

DOCUMENT TEXT:
\"\"\"{retrieved_context}\"\"\"

RULES:
- Questions must test conceptual understanding, problem solving, and nuances from the text.
- Exactly 4 options per question.
- Exactly one option must be correct (correct_answer is 0-indexed integer: 0, 1, 2, or 3).
- Provide a clear, educational explanation for why the answer is correct.
- Return raw JSON only with NO markdown formatting or code fences.

REQUIRED JSON FORMAT:
{{
  "questions": [
    {{
      "question": "Question text based on document?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Clear explanation referencing document concept."
    }}
  ]
}}
"""

    else:
        # Default RAG Grounded Q&A (action_type == "ask")
        prompt = f"""
You are CoursePilot, an academic AI study assistant for university students.
Answer the student's question accurately, clearly, and helpfully using ONLY the retrieved passages from their uploaded study material.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}

RETRIEVED DOCUMENT PASSAGES:
\"\"\"{retrieved_context}\"\"\"

STUDENT QUESTION:
"{request.question}"

STRICT RAG RULES:
1. Use the retrieved passages above as your primary factual source.
2. Do NOT invent, assume, or hallucinate facts that are not supported by the retrieved passages.
3. If the retrieved passages do not contain enough information to answer the question, explicitly state: "Based on the retrieved sections of your study material, this topic is not covered. The document focuses on [brief summary of retrieved concepts]."
4. Explain technical concepts clearly with structured formatting, code, or bullet points where relevant.
5. Reference relevant pages (e.g. "[Page 3]") in your explanation when citing specific definitions.
"""

    models_to_try = [
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
    ]

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[RAG_QUERY] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="AI document assistant is temporarily unavailable. Please try again.",
        )

    logger.info(f"[RAG_QUERY] Successfully answered query with {len(retrieved_sources)} sources for material_id={request.study_material_id}")

    return {
        "status": "success",
        "answer": response_text,
        "action_type": request.action_type,
        "source_title": title,
        "subject_name": subject_name,
        "sources": retrieved_sources,
        "confidence": confidence,
    }


# ---------------------------------------------------------
# AI STUDY PACK GENERATION ENDPOINT
# ---------------------------------------------------------

class GenerateStudyPackRequest(BaseModel):
    study_material_id: int
    user_id: str
    force_regenerate: bool = False


@app.post("/api/generate-study-pack")
async def generate_study_pack(request: GenerateStudyPackRequest):
    """
    Generates a structured, compact study pack grounded in the student's study material
    (summary, key concepts, definitions, high-yield points, common confusions, examples, quick revision).
    Uses cached study pack if available and force_regenerate is False.
    """
    logger.info(f"[STUDY_PACK] Request for material_id={request.study_material_id}, user={request.user_id[:8]}, force={request.force_regenerate}")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text, updated_at"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[STUDY_PACK] Query study_materials error: {err}")
        raise HTTPException(status_code=500, detail="Could not access study material.")

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="Study material not found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(status_code=403, detail="Access denied. You do not own this study material.")

    # 2. Check for cached study pack if not force_regenerate
    if not request.force_regenerate:
        try:
            pack_res = supabase_client.table("study_packs").select("*").eq("study_material_id", request.study_material_id).maybe_single().execute()
            if pack_res.data:
                logger.info(f"[STUDY_PACK] Returning cached study pack for material_id={request.study_material_id}")
                return {
                    "status": "success",
                    "study_pack": pack_res.data,
                    "cached": True,
                }
        except Exception as cache_err:
            logger.warning(f"[STUDY_PACK] Cache lookup notice: {cache_err}")

    # 3. Retrieve Subject and Unit
    subject_name = "Academic Course"
    if material.get("subject_id"):
        try:
            sub_res = supabase_client.table("academic_subjects").select("subject_name, subject_code").eq("id", material["subject_id"]).maybe_single().execute()
            if sub_res.data:
                code_str = f" ({sub_res.data['subject_code']})" if sub_res.data.get("subject_code") else ""
                subject_name = f"{sub_res.data['subject_name']}{code_str}"
        except Exception:
            pass

    # 4. Retrieve Matched Syllabus Topics
    matched_topics_str = "None identified"
    try:
        topics_res = supabase_client.table("study_material_topics").select(
            "match_score, syllabus_topics (topic_name)"
        ).eq("study_material_id", request.study_material_id).execute()

        if topics_res.data:
            topic_names = [
                f"{t['syllabus_topics']['topic_name']} ({int(t['match_score'])}%)"
                for t in topics_res.data
                if t.get("syllabus_topics")
            ]
            if topic_names:
                matched_topics_str = ", ".join(topic_names)
    except Exception:
        pass

    # 5. Retrieve representative RAG chunks
    retrieved_passages = []
    try:
        chunks_res = supabase_client.table("study_material_chunks").select(
            "chunk_index, content, page_number"
        ).eq("study_material_id", request.study_material_id).order("chunk_index").limit(14).execute()
        if chunks_res.data:
            retrieved_passages = [
                f"[Passage {c['chunk_index'] + 1} - Pg {c.get('page_number', 1)}]\n{c['content']}"
                for c in chunks_res.data
            ]
    except Exception as chunk_err:
        logger.warning(f"[STUDY_PACK] Chunks query notice: {chunk_err}")

    if retrieved_passages:
        source_context = "\n\n".join(retrieved_passages)
    else:
        clean_text = re.sub(r"\s+", " ", material.get("extracted_text") or "").strip()
        source_context = clean_text[:14000]

    if not source_context.strip():
        raise HTTPException(
            status_code=400,
            detail="This study document does not contain readable extracted text.",
        )

    title = material.get("title", "Study Material")
    unit_str = f"Unit {material.get('unit_number')}" if material.get("unit_number") else "General Unit"

    # 6. Prompt Gemini for structured JSON Study Pack
    prompt = f"""
You are an expert academic study-pack generator for CoursePilot.
Create a comprehensive, high-yield study pack derived STRICTLY from the student's uploaded material below.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}
MATCHED SYLLABUS TOPICS: {matched_topics_str}

RETRIEVED MATERIAL:
\"\"\"{source_context}\"\"\"

RULES:
- Do not invent, hallucinate, or assume facts not supported by the material.
- Preserve technical terms, definitions, and code/algorithm steps accurately.
- Keep explanations suitable and clear for a university B.Tech student.
- Return ONLY valid raw JSON with NO markdown code fences or backticks.

REQUIRED JSON SCHEMA:
{{
  "summary": "Concise but comprehensive 2-3 paragraph executive summary of the document.",
  "key_concepts": [
    "Core concept 1 explained clearly",
    "Core concept 2 explained clearly"
  ],
  "definitions": [
    {{
      "term": "Term Name",
      "definition": "Exact, rigorous definition from the material"
    }}
  ],
  "high_yield_points": [
    "High-yield revision takeaway 1",
    "High-yield revision takeaway 2"
  ],
  "common_confusions": [
    {{
      "confusion": "Common misconception or tricky distinction (e.g. Array vs Linked List insertion)",
      "clarification": "Clear, precise explanation resolving the confusion"
    }}
  ],
  "examples": [
    "Concrete example, code snippet, or worked problem from the material"
  ],
  "quick_revision": [
    "Actionable revision checklist item 1",
    "Actionable revision checklist item 2"
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

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[STUDY_PACK] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="Your document is indexed, but the study pack could not be generated. Please try again.",
        )

    # 7. Parse and validate JSON
    clean_json = response_text.strip()
    if clean_json.startswith("```json"): clean_json = clean_json[7:]
    if clean_json.startswith("```"): clean_json = clean_json[3:]
    if clean_json.endswith("```"): clean_json = clean_json[:-3]
    clean_json = clean_json.strip()

    try:
        pack_data = json.loads(clean_json)
    except Exception as parse_err:
        logger.error(f"[STUDY_PACK] JSON parse error: {parse_err}. Response was: {clean_json[:300]}")
        raise HTTPException(
            status_code=500,
            detail="Could not structure study pack JSON. Please try again.",
        )

    # 8. Persist into study_packs table (Upsert)
    now_iso = datetime.now(timezone.utc).isoformat()
    db_payload = {
        "study_material_id": request.study_material_id,
        "user_id": request.user_id,
        "summary": pack_data.get("summary", ""),
        "key_concepts": pack_data.get("key_concepts", []),
        "definitions": pack_data.get("definitions", []),
        "high_yield_points": pack_data.get("high_yield_points", []),
        "common_confusions": pack_data.get("common_confusions", []),
        "examples": pack_data.get("examples", []),
        "quick_revision": pack_data.get("quick_revision", []),
        "generated_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        # Delete existing study pack for this material to ensure clean upsert
        supabase_client.table("study_packs").delete().eq("study_material_id", request.study_material_id).execute()
        insert_res = supabase_client.table("study_packs").insert(db_payload).execute()
        saved_pack = insert_res.data[0] if insert_res.data else db_payload
    except Exception as save_err:
        logger.warning(f"[STUDY_PACK] Notice saving to study_packs table: {save_err}")
        saved_pack = db_payload

    logger.info(f"[STUDY_PACK] Successfully generated study pack for material_id={request.study_material_id}")

    return {
        "status": "success",
        "study_pack": saved_pack,
        "cached": False,
        "passages_used": len(retrieved_passages),
    }


# ---------------------------------------------------------
# AI FLASHCARDS GENERATION & SPACED REPETITION ENDPOINTS
# ---------------------------------------------------------

class GenerateFlashcardsRequest(BaseModel):
    study_material_id: int
    user_id: str
    count: int = Field(15, ge=5, le=30)
    force_regenerate: bool = False


@app.post("/api/generate-flashcards")
async def generate_flashcards(request: GenerateFlashcardsRequest):
    """
    Generates high-yield academic flashcards grounded in the student's study material
    using representative RAG passage chunks. Caches generated flashcards unless force_regenerate is True.
    """
    logger.info(f"[FLASHCARDS] Request for material_id={request.study_material_id}, user={request.user_id[:8]}, count={request.count}, force={request.force_regenerate}")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[FLASHCARDS] Query error: {err}")
        raise HTTPException(status_code=500, detail="Could not access study material.")

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="Study material not found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(status_code=403, detail="Access denied. You do not own this study material.")

    # 2. Check for cached flashcards if not force_regenerate
    if not request.force_regenerate:
        try:
            cards_res = supabase_client.table("study_flashcards").select("*").eq("study_material_id", request.study_material_id).order("id").execute()
            if cards_res.data and len(cards_res.data) > 0:
                logger.info(f"[FLASHCARDS] Returning {len(cards_res.data)} cached flashcards for material_id={request.study_material_id}")
                return {
                    "status": "success",
                    "flashcards": cards_res.data,
                    "count": len(cards_res.data),
                    "cached": True,
                }
        except Exception as cache_err:
            logger.warning(f"[FLASHCARDS] Cache lookup notice: {cache_err}")

    # 3. Retrieve Subject and Matched Topics
    subject_name = "Academic Course"
    if material.get("subject_id"):
        try:
            sub_res = supabase_client.table("academic_subjects").select("subject_name, subject_code").eq("id", material["subject_id"]).maybe_single().execute()
            if sub_res.data:
                code_str = f" ({sub_res.data['subject_code']})" if sub_res.data.get("subject_code") else ""
                subject_name = f"{sub_res.data['subject_name']}{code_str}"
        except Exception:
            pass

    matched_topics_str = "General Concepts"
    try:
        topics_res = supabase_client.table("study_material_topics").select(
            "match_score, syllabus_topics (topic_name)"
        ).eq("study_material_id", request.study_material_id).execute()

        if topics_res.data:
            topic_names = [
                f"{t['syllabus_topics']['topic_name']}"
                for t in topics_res.data
                if t.get("syllabus_topics")
            ]
            if topic_names:
                matched_topics_str = ", ".join(topic_names)
    except Exception:
        pass

    # 4. Retrieve representative RAG chunks
    retrieved_passages = []
    try:
        chunks_res = supabase_client.table("study_material_chunks").select(
            "id, chunk_index, content, page_number"
        ).eq("study_material_id", request.study_material_id).order("chunk_index").limit(16).execute()
        if chunks_res.data:
            for c in chunks_res.data:
                retrieved_passages.append(
                    f"[Chunk #{c['id']} - Page {c.get('page_number', 1)}]\n{c['content']}"
                )
    except Exception as chunk_err:
        logger.warning(f"[FLASHCARDS] Chunks query notice: {chunk_err}")

    if retrieved_passages:
        source_context = "\n\n".join(retrieved_passages)
    else:
        clean_text = re.sub(r"\s+", " ", material.get("extracted_text") or "").strip()
        source_context = clean_text[:14000]

    if not source_context.strip():
        raise HTTPException(
            status_code=400,
            detail="This study document does not contain readable extracted text.",
        )

    title = material.get("title", "Study Material")
    unit_str = f"Unit {material.get('unit_number')}" if material.get("unit_number") else "General Unit"

    # 5. Prompt Gemini for structured flashcards
    prompt = f"""
You are an expert academic flashcard generator for CoursePilot.
Create exactly {request.count} high-yield study flashcards derived STRICTLY from the provided material.

DOCUMENT: {title}
SUBJECT: {subject_name}
UNIT: {unit_str}
MATCHED SYLLABUS TOPICS: {matched_topics_str}

RETRIEVED MATERIAL:
\"\"\"{source_context}\"\"\"

RULES:
- Test core concepts, essential definitions, key distinctions, time/space complexities, algorithms, and formulas.
- Questions must be clear, active, and specific (e.g. "What is the time complexity of deleting a node at the head of a singly linked list?").
- Answers must be concise, accurate, and direct (1-3 sentences or bullet points).
- Assign an appropriate difficulty: 'easy', 'medium', or 'hard'.
- Tag each card with its specific topic_name (e.g., from matched topics).
- Include relevant source_chunk_ids if identifiable from the [Chunk #ID] tags in the text, or an empty list.
- Return ONLY valid raw JSON with NO markdown code fences or backticks.

REQUIRED JSON SCHEMA:
{{
  "flashcards": [
    {{
      "question": "Question text?",
      "answer": "Concise, precise answer.",
      "topic_name": "Topic Name",
      "difficulty": "medium",
      "source_chunk_ids": []
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

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[FLASHCARDS] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="Flashcard generation failed. Your study material is still safe.",
        )

    # 6. Parse and validate JSON
    clean_json = response_text.strip()
    if clean_json.startswith("```json"): clean_json = clean_json[7:]
    if clean_json.startswith("```"): clean_json = clean_json[3:]
    if clean_json.endswith("```"): clean_json = clean_json[:-3]
    clean_json = clean_json.strip()

    try:
        cards_data = json.loads(clean_json)
        raw_cards = cards_data.get("flashcards", [])
        if not isinstance(raw_cards, list) or len(raw_cards) == 0:
            raise ValueError("No flashcards array in response.")
    except Exception as parse_err:
        logger.error(f"[FLASHCARDS] Parse error: {parse_err}. Response was: {clean_json[:300]}")
        raise HTTPException(
            status_code=500,
            detail="Could not parse generated flashcards JSON. Please try again.",
        )

    # 7. Persist to study_flashcards table (Clean replace)
    now_iso = datetime.now(timezone.utc).isoformat()
    db_records = [
        {
            "study_material_id": request.study_material_id,
            "user_id": request.user_id,
            "question": c.get("question", "").strip(),
            "answer": c.get("answer", "").strip(),
            "topic_name": c.get("topic_name", "General"),
            "difficulty": c.get("difficulty", "medium") if c.get("difficulty") in ["easy", "medium", "hard"] else "medium",
            "source_chunk_ids": c.get("source_chunk_ids", []),
            "review_count": 0,
            "next_review_at": now_iso,
            "created_at": now_iso,
        }
        for c in raw_cards
        if c.get("question") and c.get("answer")
    ]

    try:
        # Delete previous flashcards for this material if regenerating or replacing
        supabase_client.table("study_flashcards").delete().eq("study_material_id", request.study_material_id).execute()
        insert_res = supabase_client.table("study_flashcards").insert(db_records).execute()
        saved_cards = insert_res.data if insert_res.data else db_records
    except Exception as save_err:
        logger.warning(f"[FLASHCARDS] Notice saving to study_flashcards table: {save_err}")
        saved_cards = db_records

    logger.info(f"[FLASHCARDS] Successfully created {len(saved_cards)} flashcards for material_id={request.study_material_id}")

    return {
        "status": "success",
        "flashcards": saved_cards,
        "count": len(saved_cards),
        "cached": False,
    }


class ReviewFlashcardRequest(BaseModel):
    flashcard_id: int
    user_id: str
    rating: str = Field(..., pattern="^(again|hard|good|easy)$")


@app.post("/api/review-flashcard")
async def review_flashcard(request: ReviewFlashcardRequest):
    """
    Records a student's self-assessment review rating ('again', 'hard', 'good', 'easy')
    and updates the spaced-repetition next_review_at timestamp.
    """
    logger.info(f"[FLASHCARD_REVIEW] Card {request.flashcard_id}, rating={request.rating}, user={request.user_id[:8]}...")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    # 1. Fetch flashcard and verify ownership
    try:
        card_res = supabase_client.table("study_flashcards").select(
            "id, user_id, review_count, next_review_at"
        ).eq("id", request.flashcard_id).execute()
    except Exception as err:
        logger.error(f"[FLASHCARD_REVIEW] Query error: {err}")
        raise HTTPException(status_code=500, detail="Could not access flashcard.")

    if not card_res.data:
        raise HTTPException(status_code=404, detail="Flashcard not found.")

    card = card_res.data[0]
    if str(card.get("user_id")) != str(request.user_id):
        raise HTTPException(status_code=403, detail="Access denied. You do not own this flashcard.")

    # 2. Compute spaced-repetition next_review_at
    current_count = card.get("review_count") or 0
    new_count = current_count + 1
    now = datetime.now(timezone.utc)

    if request.rating == "again":
        delta = timedelta(minutes=10)
    elif request.rating == "hard":
        delta = timedelta(days=1 * max(1, current_count))
    elif request.rating == "good":
        delta = timedelta(days=3 * max(1, current_count))
    else:  # 'easy'
        delta = timedelta(days=7 * max(1, current_count))

    next_review = (now + delta).isoformat()
    now_iso = now.isoformat()

    # 3. Update study_flashcards record
    try:
        supabase_client.table("study_flashcards").update({
            "review_count": new_count,
            "last_reviewed_at": now_iso,
            "next_review_at": next_review,
        }).eq("id", request.flashcard_id).execute()
    except Exception as update_err:
        logger.warning(f"[FLASHCARD_REVIEW] Update card notice: {update_err}")

    # 4. Insert into flashcard_reviews table
    try:
        supabase_client.table("flashcard_reviews").insert({
            "flashcard_id": request.flashcard_id,
            "user_id": request.user_id,
            "rating": request.rating,
            "reviewed_at": now_iso,
        }).execute()
    except Exception as rev_err:
        logger.warning(f"[FLASHCARD_REVIEW] Insert review log notice: {rev_err}")

    return {
        "status": "success",
        "flashcard_id": request.flashcard_id,
        "rating": request.rating,
        "review_count": new_count,
        "next_review_at": next_review,
    }


# ---------------------------------------------------------
# PREVIOUS-YEAR QUESTION PAPER ANALYZER ENDPOINT
# ---------------------------------------------------------

class AnalyzeExamPaperRequest(BaseModel):
    study_material_id: int
    user_id: str
    force_regenerate: bool = False


@app.post("/api/analyze-exam-paper")
async def analyze_exam_paper(request: AnalyzeExamPaperRequest):
    """
    Analyzes an uploaded Previous-Year Question Paper, extracting question count,
    topic frequency, marks distribution, repeated concepts, question patterns, and revision priorities.
    Caches results unless force_regenerate is True.
    """
    logger.info(f"[EXAM_ANALYZER] Request for material_id={request.study_material_id}, user={request.user_id[:8]}, force={request.force_regenerate}")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[EXAM_ANALYZER] Query error: {err}")
        raise HTTPException(status_code=500, detail="Could not access study material.")

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="Study material not found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(request.user_id):
        raise HTTPException(status_code=403, detail="Access denied. You do not own this question paper.")

    # 2. Check for cached analysis if not force_regenerate
    if not request.force_regenerate:
        try:
            analysis_res = supabase_client.table("exam_paper_analysis").select("*").eq("study_material_id", request.study_material_id).maybe_single().execute()
            if analysis_res.data:
                logger.info(f"[EXAM_ANALYZER] Returning cached exam paper analysis for material_id={request.study_material_id}")
                return {
                    "status": "success",
                    "analysis": analysis_res.data,
                    "cached": True,
                }
        except Exception as cache_err:
            logger.warning(f"[EXAM_ANALYZER] Cache lookup notice: {cache_err}")

    # 3. Retrieve Subject and Syllabus Topics
    subject_name = "Academic Course"
    syllabus_topics_list = []
    if material.get("subject_id"):
        try:
            sub_res = supabase_client.table("academic_subjects").select("subject_name, subject_code").eq("id", material["subject_id"]).maybe_single().execute()
            if sub_res.data:
                code_str = f" ({sub_res.data['subject_code']})" if sub_res.data.get("subject_code") else ""
                subject_name = f"{sub_res.data['subject_name']}{code_str}"
        except Exception:
            pass

        try:
            top_res = supabase_client.table("syllabus_topics").select("id, unit_number, topic_name").eq("subject_id", material["subject_id"]).execute()
            if top_res.data:
                syllabus_topics_list = [f"Unit {t.get('unit_number', 1)}: {t['topic_name']}" for t in top_res.data]
        except Exception:
            pass

    syllabus_topics_str = "\n".join(syllabus_topics_list) if syllabus_topics_list else "Standard Engineering Curriculum"

    # 4. Retrieve RAG chunks
    retrieved_passages = []
    try:
        chunks_res = supabase_client.table("study_material_chunks").select(
            "id, chunk_index, content, page_number"
        ).eq("study_material_id", request.study_material_id).order("chunk_index").limit(18).execute()
        if chunks_res.data:
            for c in chunks_res.data:
                retrieved_passages.append(
                    f"[Passage {c['chunk_index'] + 1} - Page {c.get('page_number', 1)}]\n{c['content']}"
                )
    except Exception as chunk_err:
        logger.warning(f"[EXAM_ANALYZER] Chunks query notice: {chunk_err}")

    if retrieved_passages:
        source_context = "\n\n".join(retrieved_passages)
    else:
        clean_text = re.sub(r"\s+", " ", material.get("extracted_text") or "").strip()
        source_context = clean_text[:15000]

    if not source_context.strip():
        raise HTTPException(
            status_code=400,
            detail="The question paper is safely uploaded, but readable text was not found.",
        )

    title = material.get("title", "Previous Year Question Paper")

    # 5. Prompt Gemini for structured analysis
    prompt = f"""
You are an expert university examination paper analyzer for CoursePilot.
Analyze the following university question paper strictly using the extracted paper text and the provided syllabus topics.

DOCUMENT: {title}
SUBJECT: {subject_name}

SYLLABUS TOPICS:
\"\"\"{syllabus_topics_str}\"\"\"

QUESTION PAPER CONTENT:
\"\"\"{source_context}\"\"\"

ANALYZE:
1. Total number of questions in the paper (count sub-questions if distinct).
2. Unit-wise question distribution (Unit 1, 2, 3, 4, etc.).
3. Topic frequency: which syllabus topics are tested most often and their approximate question count.
4. Repeated concepts: topics or core concepts that appear multiple times across sections.
5. Marks distribution: breakdown of 2-mark, 5-mark, 10-mark, 15-mark questions if discernible (or estimated).
6. Difficulty distribution: counts for easy, medium, and hard questions.
7. Question patterns: recurring formulation styles (e.g., "Explain with diagram", "Algorithm implementation", "Derivations", "Complexity analysis", "Compare and contrast").
8. Revision priorities: topics that appeared frequently with practical reasons for prioritized review.

RULES:
- Base analysis ONLY on the actual uploaded paper text.
- Do not claim that this analysis predicts future exam questions. Use phrasing like "Frequently tested in uploaded paper".
- Return ONLY valid raw JSON with NO markdown code fences or backticks.

REQUIRED JSON SCHEMA:
{{
  "total_questions": 25,
  "detected_units": [
    {{
      "unit": 1,
      "question_count": 6
    }}
  ],
  "topic_frequency": [
    {{
      "topic": "Linked Lists",
      "question_count": 4,
      "percentage": 16.0
    }}
  ],
  "question_patterns": [
    {{
      "pattern": "Explain and compare data structures",
      "count": 3
    }}
  ],
  "marks_distribution": [
    {{
      "marks": 2,
      "question_count": 8
    }}
  ],
  "difficulty_distribution": {{
    "easy": 6,
    "medium": 12,
    "hard": 7
  }},
  "repeated_topics": [
    {{
      "topic": "Binary Search Trees",
      "appearances": 3
    }}
  ],
  "revision_priorities": [
    {{
      "topic": "Binary Search Trees",
      "reason": "Appeared multiple times across Section B and Section C in the uploaded paper",
      "priority": 9
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

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[EXAM_ANALYZER] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="The question paper is safely uploaded, but analysis could not be completed. Please try again.",
        )

    # 6. Parse and validate JSON
    clean_json = response_text.strip()
    if clean_json.startswith("```json"): clean_json = clean_json[7:]
    if clean_json.startswith("```"): clean_json = clean_json[3:]
    if clean_json.endswith("```"): clean_json = clean_json[:-3]
    clean_json = clean_json.strip()

    try:
        analysis_data = json.loads(clean_json)
    except Exception as parse_err:
        logger.error(f"[EXAM_ANALYZER] Parse error: {parse_err}. Response was: {clean_json[:300]}")
        raise HTTPException(
            status_code=500,
            detail="Could not structure paper analysis JSON. Please try again.",
        )

    # 7. Persist to exam_paper_analysis table
    now_iso = datetime.now(timezone.utc).isoformat()
    db_payload = {
        "study_material_id": request.study_material_id,
        "user_id": request.user_id,
        "total_questions": analysis_data.get("total_questions", 0),
        "detected_units": analysis_data.get("detected_units", []),
        "topic_frequency": analysis_data.get("topic_frequency", []),
        "question_patterns": analysis_data.get("question_patterns", []),
        "marks_distribution": analysis_data.get("marks_distribution", []),
        "difficulty_distribution": analysis_data.get("difficulty_distribution", {}),
        "repeated_topics": analysis_data.get("repeated_topics", []),
        "revision_priorities": analysis_data.get("revision_priorities", []),
        "generated_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        supabase_client.table("exam_paper_analysis").delete().eq("study_material_id", request.study_material_id).execute()
        insert_res = supabase_client.table("exam_paper_analysis").insert(db_payload).execute()
        saved_record = insert_res.data[0] if insert_res.data else db_payload
    except Exception as save_err:
        logger.warning(f"[EXAM_ANALYZER] Notice saving to exam_paper_analysis table: {save_err}")
        saved_record = db_payload

    logger.info(f"[EXAM_ANALYZER] Successfully analyzed question paper material_id={request.study_material_id}")

    return {
        "status": "success",
        "analysis": saved_record,
        "cached": False,
        "passages_used": len(retrieved_passages),
    }


# ---------------------------------------------------------
# GLOBAL ACADEMIC SEARCH ENDPOINT
# ---------------------------------------------------------

class AcademicSearchRequest(BaseModel):
    query: str
    user_id: str
    semester: Optional[int] = None
    section: Optional[str] = None
    limit: int = Field(25, ge=1, le=50)


@app.post("/api/academic-search")
async def academic_search(request: AcademicSearchRequest):
    """
    Unified academic search combining deterministic keyword matching with semantic RAG
    across syllabus topics, study materials, previous-year question papers, flashcards, tasks, and exams.
    """
    logger.info(f"[ACADEMIC_SEARCH] Query='{request.query[:30]}', user={request.user_id[:8]}..., sem={request.semester}")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    if not request.query or len(request.query.strip()) < 2:
        return {
            "status": "success",
            "query": request.query,
            "total_results": 0,
            "results": [],
        }

    try:
        from services.academic_search import search_academic_workspace

        results = await search_academic_workspace(
            supabase_client=supabase_client,
            query=request.query,
            user_id=request.user_id,
            semester=request.semester,
            limit=request.limit,
        )

        return {
            "status": "success",
            "query": request.query,
            "total_results": len(results),
            "results": results,
        }
    except Exception as err:
        logger.error(f"[ACADEMIC_SEARCH] Search error: {err}")
        raise HTTPException(status_code=500, detail="Search could not be completed.")


# ---------------------------------------------------------
# AI STUDY COPILOT CHAT ENDPOINT
# ---------------------------------------------------------

class CopilotChatRequest(BaseModel):
    message: str
    user_id: str
    conversation_id: Optional[int] = None


@app.post("/api/copilot-chat")
async def copilot_chat(request: CopilotChatRequest):
    """
    Contextual AI Study Copilot chat endpoint.
    Retrieves real server-side academic context and RAG passages, executes intent routing,
    prompts Gemini for concise actionable responses with action buttons, and persists conversation.
    """
    clean_msg = request.message.strip()
    if not clean_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info(f"[COPILOT_CHAT] User={request.user_id[:8]}..., conv={request.conversation_id}, msg='{clean_msg[:35]}'")

    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database client not configured.")

    # 1. Manage Conversation Record
    conv_id = request.conversation_id
    now_iso = datetime.now(timezone.utc).isoformat()

    if conv_id:
        try:
            conv_res = supabase_client.table("copilot_conversations").select(
                "id, user_id, title"
            ).eq("id", conv_id).maybe_single().execute()

            if not conv_res.data:
                conv_id = None
            elif str(conv_res.data.get("user_id")) != str(request.user_id):
                raise HTTPException(status_code=403, detail="Access denied. You do not own this conversation.")
        except HTTPException:
            raise
        except Exception as conv_err:
            logger.warning(f"[COPILOT_CHAT] Conversation check note: {conv_err}")
            conv_id = None

    if not conv_id:
        try:
            title_snippet = clean_msg[:35] + ("..." if len(clean_msg) > 35 else "")
            new_conv = supabase_client.table("copilot_conversations").insert({
                "user_id": request.user_id,
                "title": title_snippet,
                "created_at": now_iso,
                "updated_at": now_iso,
            }).execute()
            if new_conv.data:
                conv_id = new_conv.data[0]["id"]
            else:
                conv_id = None
        except Exception as create_err:
            logger.warning(f"[COPILOT_CHAT] New conversation creation note: {create_err}")
            conv_id = None

    # 2. Build Server-Side Academic Context
    from services.copilot_context import build_copilot_context
    academic_ctx = await build_copilot_context(supabase_client, request.user_id)

    # 3. Check for Study Material / Notes Intent for RAG vector search
    norm_msg = clean_msg.lower()
    is_notes_query = bool(re.search(r"\b(notes|notes on|from my notes|uploaded notes|pdf|material|in my notes)\b", norm_msg))
    retrieved_sources = []
    rag_passages = []

    if is_notes_query and embed_query:
        try:
            q_emb = embed_query(clean_msg)
            if q_emb and len(q_emb) == 768:
                rpc_res = supabase_client.rpc(
                    "match_study_material_chunks",
                    {
                        "query_embedding": q_emb,
                        "match_threshold": 0.35,
                        "match_count": 4,
                        "target_study_material_id": None,
                    }
                ).execute()

                if rpc_res.data:
                    mat_ids = list(set([c["study_material_id"] for c in rpc_res.data if c.get("study_material_id")]))
                    owned_res = supabase_client.table("study_materials").select("id, title").in_("id", mat_ids).eq("user_id", request.user_id).execute()
                    owned_map = {m["id"]: m["title"] for m in (owned_res.data or [])}

                    for chunk in rpc_res.data:
                        mid = chunk.get("study_material_id")
                        if mid in owned_map:
                            doc_title = owned_map[mid]
                            p_num = chunk.get("page_number", 1)
                            rag_passages.append(f"[Source: {doc_title}, Page {p_num}]\n{chunk.get('content')}")
                            retrieved_sources.append({
                                "title": doc_title,
                                "page_number": p_num,
                                "material_id": mid,
                            })
        except Exception as rag_err:
            logger.warning(f"[COPILOT_CHAT] RAG retrieval notice: {rag_err}")

    rag_context_str = "\n\n".join(rag_passages) if rag_passages else "No relevant study material chunks found."

    # 4. Fetch recent conversation history (last 4 messages)
    chat_history_str = ""
    if conv_id:
        try:
            hist_res = supabase_client.table("copilot_messages").select(
                "role, content"
            ).eq("conversation_id", conv_id).order("created_at", desc=True).limit(4).execute()
            if hist_res.data:
                reversed_msgs = list(reversed(hist_res.data))
                chat_history_str = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in reversed_msgs])
        except Exception as hist_err:
            logger.warning(f"[COPILOT_CHAT] Chat history fetch note: {hist_err}")

    # 5. Build Gemini Prompt
    prompt = f"""
You are AI Campus Copilot, a precise, concise, and context-aware academic assistant for a university engineering student.

STUDENT ACADEMIC CONTEXT:
{json.dumps(academic_ctx, indent=2)}

RELEVANT UPLOADED STUDY MATERIAL PASSAGES:
{rag_context_str}

RECENT CONVERSATION:
{chat_history_str}

USER QUERY:
"{clean_msg}"

SYSTEM INSTRUCTIONS:
- Base your answers strictly on the student's actual academic context and timetable provided above.
- Treat application-provided data as authoritative.
- Never invent timetable classes, exams, attendance percentages, or mastery scores.
- If the student asks about a subject or data not present in the context, explicitly say you do not have enough recorded data yet.
- Keep the response direct, concise (2-4 brief paragraphs or bullet points max), and academic.
- Avoid excessive generic motivational filler.
- If relevant, recommend ONE or TWO high-value structured actions.
  Supported action types:
  - "start_focus" (with minutes and optional task_id or topic)
  - "open_exam_mode"
  - "open_timetable"
  - "open_progress"
  - "open_attendance"
  - "open_study_material" (with material_id if applicable)
  - "open_task" (with task_id if applicable)

OUTPUT FORMAT: Return raw JSON ONLY with no markdown backticks:
{{
  "message": "Your clear, direct, and actionable answer...",
  "actions": [
    {{
      "type": "start_focus",
      "label": "Start Trees Revision (45m)",
      "minutes": 45
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

    response_text = None
    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                response_text = resp.text
            else:
                model = genai_legacy.GenerativeModel(model_name)
                resp = model.generate_content(prompt)
                response_text = resp.text

            if response_text:
                break
        except Exception as err:
            last_error = err

    if not response_text:
        logger.error(f"[COPILOT_CHAT] Gemini generation failed: {last_error}")
        nba = academic_ctx.get("next_best_action") or {}
        fallback_msg = f"Here is what deserves your attention right now: {nba.get('title', 'Review your academic priorities')}. {nba.get('reason', '')}"
        return {
            "status": "success",
            "conversation_id": conv_id,
            "message": fallback_msg,
            "actions": [{"type": nba.get("type", "open_timetable"), "label": nba.get("title", "View Schedule")}],
            "sources": [],
        }

    # 6. Parse JSON Response
    clean_json = response_text.strip()
    if clean_json.startswith("```json"): clean_json = clean_json[7:]
    if clean_json.startswith("```"): clean_json = clean_json[3:]
    if clean_json.endswith("```"): clean_json = clean_json[:-3]
    clean_json = clean_json.strip()

    try:
        parsed_resp = json.loads(clean_json)
        assistant_msg = parsed_resp.get("message", response_text)
        actions = parsed_resp.get("actions", [])
    except Exception:
        assistant_msg = response_text
        actions = []

    # 7. Persist User & Assistant Messages
    if conv_id:
        try:
            supabase_client.table("copilot_messages").insert([
                {
                    "conversation_id": conv_id,
                    "user_id": request.user_id,
                    "role": "user",
                    "content": clean_msg,
                    "created_at": now_iso,
                },
                {
                    "conversation_id": conv_id,
                    "user_id": request.user_id,
                    "role": "assistant",
                    "content": assistant_msg,
                    "actions": actions,
                    "sources": retrieved_sources,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ]).execute()

            supabase_client.table("copilot_conversations").update({
                "updated_at": now_iso,
            }).eq("id", conv_id).execute()
        except Exception as db_err:
            logger.warning(f"[COPILOT_CHAT] Messages persist note: {db_err}")

    return {
        "status": "success",
        "conversation_id": conv_id,
        "message": assistant_msg,
        "actions": actions,
        "sources": retrieved_sources,
    }









