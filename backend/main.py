import os
import urllib.parse
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
google_redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "")

# In-memory secure token store for calendar OAuth (user_id -> tokens)
calendar_token_store = {}

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not configured.")

app = FastAPI(title="CoursePilot API", docs_url=None, redoc_url=None)

# Enable CORS for Vite frontend (local and deployed on Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://ai-campus-copilot-one.vercel.app",
    ],
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
    client_id = google_client_id
    if not client_id:
        # Return fallback guidance if OAuth credentials are not set in environment
        return {
            "configured": False,
            "auth_url": None,
            "message": "Google Calendar OAuth client is not yet configured in environment variables.",
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
    if not google_client_id or not google_client_secret:
        raise HTTPException(
            status_code=400,
            detail="Google Calendar credentials are not configured on the backend.",
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

