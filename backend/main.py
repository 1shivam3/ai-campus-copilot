import json
import logging
import os
import random
import re
import sys
import urllib.parse
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException, Request, Response, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.embeddings import embed_text, embed_query, embed_batch
from services.chunking import chunk_document_text
from services.auth import get_current_user, get_optional_user, AuthenticatedUser
from services.calendar_auth import (
    generate_oauth_state,
    verify_oauth_state,
    save_calendar_tokens,
    get_calendar_tokens,
    delete_calendar_tokens,
)
from services.rate_limiter import check_rate_limit

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("coursepilot.backend")

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv()
load_dotenv(os.path.join(backend_dir, ".env"))

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_KEY") or os.getenv("GOOGLE_API_KEY")
google_client_id = os.getenv("GOOGLE_CLIENT_ID", "")
google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
google_redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "")

# Initialize centralized Supabase client from services.database
from services.database import get_database_client, init_database_client

def get_supabase_client() -> Client:
    """
    Thread-safe getter for the single server-side Supabase client.
    Works seamlessly across sync/async request handlers and background tasks.
    """
    return get_database_client()

try:
    supabase_client: Client | None = get_database_client()
except Exception as e:
    supabase_client = None
    logger.warning(f"Could not initialize Supabase backend client on module import: {e}")

def parse_llm_json(raw_text: str) -> dict:
    """
    Robust JSON parser for LLM responses.
    Handles markdown code fences, leading/trailing conversational text,
    trailing commas, unescaped newlines, and common formatting anomalies.
    """
    if not raw_text or not isinstance(raw_text, str):
        raise ValueError("Empty or invalid response from AI model.")

    text = raw_text.strip()

    # 1. Direct try
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2. Extract content from ```json ... ``` or ``` ... ``` code fence
    fence_pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)
    fenced_match = fence_pattern.search(text)
    if fenced_match:
        candidate = fenced_match.group(1).strip()
        try:
            return json.loads(candidate)
        except Exception:
            text = candidate

    # 3. Search for outermost JSON object { ... } or array [ ... ]
    start_brace = text.find("{")
    start_bracket = text.find("[")

    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        end_brace = text.rfind("}")
        if end_brace > start_brace:
            candidate = text[start_brace : end_brace + 1].strip()
            try:
                return json.loads(candidate)
            except Exception:
                cleaned = re.sub(r",\s*([\]\}])", r"\1", candidate)
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass
    elif start_bracket != -1:
        end_bracket = text.rfind("]")
        if end_bracket > start_bracket:
            candidate = text[start_bracket : end_bracket + 1].strip()
            try:
                return json.loads(candidate)
            except Exception:
                cleaned = re.sub(r",\s*([\]\}])", r"\1", candidate)
                try:
                    return json.loads(cleaned)
                except Exception:
                    pass

    # 4. Final attempt: normalize newlines inside string literals
    try:
        candidate_fixed = re.sub(r'[\r\n\t]+', ' ', text)
        return json.loads(candidate_fixed)
    except Exception as final_err:
        raise ValueError(f"Could not parse valid JSON from AI response: {final_err}")


def shuffle_mcq_options(q_dict: dict) -> dict:
    """
    Shuffles MCQ options with stable option ID tracking to ensure
    the correct answer is genuinely varied across A, B, C, D (indices 0, 1, 2, 3).
    """
    if not isinstance(q_dict, dict):
        return q_dict
    options = q_dict.get("options")
    if not isinstance(options, list) or len(options) < 2:
        return q_dict

    orig_idx = q_dict.get("correct_answer")
    if orig_idx is None:
        orig_idx = q_dict.get("correct_index", 0)
    try:
        orig_idx = int(orig_idx)
    except (ValueError, TypeError):
        orig_idx = 0
    if orig_idx < 0 or orig_idx >= len(options):
        orig_idx = 0

    labeled = []
    for i, opt in enumerate(options):
        opt_text = opt.get("text", str(opt)) if isinstance(opt, dict) else str(opt)
        opt_id = opt.get("id", f"opt_{i}") if isinstance(opt, dict) else f"opt_{i}"
        labeled.append({
            "id": opt_id,
            "text": opt_text,
            "is_correct": (i == orig_idx)
        })

    random.shuffle(labeled)

    new_options = []
    new_correct_idx = 0
    for new_i, item in enumerate(labeled):
        new_options.append(item["text"])
        if item["is_correct"]:
            new_correct_idx = new_i

    q_dict["options"] = new_options
    q_dict["correct_answer"] = new_correct_idx
    q_dict["correct_index"] = new_correct_idx
    q_dict["correct_option_id"] = f"opt_{new_correct_idx}"
    return q_dict


def normalize_and_shuffle_quiz_json(raw_text: str) -> str:
    """
    Parses quiz JSON and shuffles all MCQ options so correct answers vary across A, B, C, D.
    """
    try:
        parsed = parse_llm_json(raw_text)
        if isinstance(parsed, dict) and "questions" in parsed and isinstance(parsed["questions"], list):
            for q in parsed["questions"]:
                if isinstance(q, dict) and "options" in q:
                    shuffle_mcq_options(q)
            return json.dumps(parsed)
    except Exception:
        pass
    return raw_text


app = FastAPI(title="CoursePilot API", docs_url=None, redoc_url=None)

@app.on_event("startup")
async def on_startup():
    """
    Validates server-side database configuration on startup so that
    foreground endpoints and background workers never fail with unconfigured clients.
    """
    try:
        client = get_database_client()
        logger.info("[STARTUP] Server-side Supabase client verified and ready for all foreground and background tasks.")
    except Exception as err:
        logger.error(f"[STARTUP] Critical: Supabase client initialization failed: {err}")

# Explicit CORS allowlist - No open wildcard regex
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
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "Origin"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Initialize Gemini SDK
client = None
USE_NEW_SDK = False

if api_key:
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        USE_NEW_SDK = True
    except (ImportError, Exception):
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=api_key)
            USE_NEW_SDK = False
        except Exception as e:
            logger.warning(f"Could not configure Gemini legacy SDK: {e}")


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
def generate_exam_quiz(
    request: ExamQuizRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    check_rate_limit(current_user.id, "generate_exam_quiz", max_requests=25, window_seconds=60)
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return {"quiz": normalize_and_shuffle_quiz_json(response.text)}
            else:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return {"quiz": normalize_and_shuffle_quiz_json(response.text)}
        except Exception as err:
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="Exam quiz generation is currently unavailable. Please try again in a few moments.",
    )


class ExamQuestionRequest(BaseModel):
    subject_id: int | None = None
    subject_name: str = Field(..., min_length=1, max_length=200)
    syllabus_type: str = Field("theory", max_length=50)
    question_type: str = Field("mcq", max_length=50)  # "mcq" | "short_answer" | "long_answer"
    selected_units: list[str] = Field(default_factory=list)
    difficulty: str = Field("mixed", max_length=50)  # "easy" | "medium" | "hard" | "mixed"
    answer_mode: str = Field("question_only", max_length=50)
    used_questions: list[str] = Field(default_factory=list)


@app.post("/api/generate-exam-question")
def generate_exam_question(
    request: ExamQuestionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    check_rate_limit(current_user.id, "generate_exam_question", max_requests=30, window_seconds=60)
    if not request.subject_name.strip():
        raise HTTPException(status_code=400, detail="Subject name is required.")

    # 1. Fetch syllabus topics from Supabase
    sb = get_supabase_client()
    topics_data = []
    if sb:
        try:
            if request.subject_id:
                res = sb.table("syllabus_topics").select("id, unit_number, topic_name, description").eq("subject_id", request.subject_id).order("unit_number").execute()
                topics_data = res.data or []
            if not topics_data and request.subject_name:
                sub_res = sb.table("academic_subjects").select("id, subject_type").ilike("subject_name", f"%{request.subject_name.strip()}%").limit(1).execute()
                if sub_res.data:
                    s_id = sub_res.data[0]["id"]
                    res = sb.table("syllabus_topics").select("id, unit_number, topic_name, description").eq("subject_id", s_id).order("unit_number").execute()
                    topics_data = res.data or []
        except Exception as e:
            logger.warning(f"Error querying Supabase syllabus topics for question generation: {e}")

    # 2. Filter topics by selected_units / practicals if specified
    is_lab = request.syllabus_type.lower() == "lab" or "lab" in request.subject_name.lower() or request.subject_name.endswith("L")
    selected_numbers = set()
    for u_str in request.selected_units:
        digits = re.findall(r"\d+", str(u_str))
        if digits:
            selected_numbers.add(int(digits[0]))

    if topics_data and selected_numbers:
        filtered_topics = [t for t in topics_data if t.get("unit_number") in selected_numbers]
        if filtered_topics:
            topics_data = filtered_topics

    # 3. Select target unit/practical
    grouped_by_unit = {}
    for t in topics_data:
        unit_num = t.get("unit_number") or 1
        grouped_by_unit.setdefault(unit_num, []).append(t)

    if grouped_by_unit:
        chosen_unit_num = random.choice(list(grouped_by_unit.keys()))
        target_topics = grouped_by_unit[chosen_unit_num]
    else:
        chosen_unit_num = random.choice(list(selected_numbers)) if selected_numbers else 1
        target_topics = [{
            "topic_name": f"{request.subject_name} Core Concepts",
            "description": f"Fundamental concepts and applications of {request.subject_name}"
        }]

    scope_label = f"Practical {chosen_unit_num}" if is_lab else f"Unit {chosen_unit_num}"

    # 4. Difficulty selection
    diff_req = (request.difficulty or "mixed").strip().lower()
    if diff_req == "mixed":
        chosen_difficulty = random.choice(["easy", "medium", "hard"])
    elif diff_req in ["easy", "medium", "hard"]:
        chosen_difficulty = diff_req
    else:
        chosen_difficulty = "medium"

    q_type = (request.question_type or "mcq").strip().lower()
    if q_type not in ["mcq", "short_answer", "long_answer"]:
        q_type = "mcq"

    # 5. Build context & previous questions exclusion clause
    context_lines = []
    for t in target_topics:
        name = t.get("topic_name", "")
        desc = t.get("description", "")
        context_lines.append(f"- {name}: {desc}" if desc else f"- {name}")
    context_str = "\n".join(context_lines)

    used_str = ""
    if request.used_questions:
        cleaned_used = [q.strip() for q in request.used_questions if q.strip()][-12:]
        if cleaned_used:
            formatted_used = "\n".join(f"- {q}" for q in cleaned_used)
            used_str = f"\nPREVIOUSLY USED QUESTIONS (DO NOT DUPLICATE OR REPEAT ANY OF THESE):\n{formatted_used}\n"

    # 6. Build prompt based on question type
    if q_type == "mcq":
        prompt = f"""
You are generating exactly ONE B.Tech exam-practice multiple-choice question for CoursePilot.

SUBJECT: {request.subject_name}
SYLLABUS TYPE: {'Lab / Practical' if is_lab else 'Theory'}
SYLLABUS SCOPE: {scope_label}
DIFFICULTY: {chosen_difficulty.capitalize()}

SYLLABUS TOPIC CONTENT:
{context_str}
{used_str}
RULES:
1. Generate exactly ONE high-quality multiple choice question strictly based on the syllabus content for {scope_label}.
2. Provide exactly 4 options.
3. Exactly one option is correct (correct_answer is a 0-indexed integer: 0, 1, 2, or 3).
4. Provide a clear, educational explanation explaining why the correct option is right.
5. Return raw JSON ONLY without any markdown backticks, markdown fences, or extra text.

JSON FORMAT:
{{
  "unit": "{scope_label}",
  "question_type": "mcq",
  "difficulty": "{chosen_difficulty}",
  "question": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": 0,
  "explanation": "Why this answer is correct."
}}
"""
    elif q_type == "short_answer":
        prompt = f"""
You are generating exactly ONE B.Tech short-answer exam question for CoursePilot.

SUBJECT: {request.subject_name}
SYLLABUS TYPE: {'Lab / Practical' if is_lab else 'Theory'}
SYLLABUS SCOPE: {scope_label}
DIFFICULTY: {chosen_difficulty.capitalize()}

SYLLABUS TOPIC CONTENT:
{context_str}
{used_str}
RULES:
1. Generate exactly ONE focused short-answer university exam question strictly based on the syllabus content for {scope_label}.
2. Provide a concise expected answer (2-4 sentences).
3. Provide 2-4 key conceptual bullet points that must be included in a high-scoring answer.
4. Provide a concise explanation or concept summary.
5. Return raw JSON ONLY without any markdown backticks, markdown fences, or extra text.

JSON FORMAT:
{{
  "unit": "{scope_label}",
  "question_type": "short_answer",
  "difficulty": "{chosen_difficulty}",
  "question": "Clear short answer question text here?",
  "expected_answer": "Concise and accurate model answer.",
  "key_points": ["Key concept 1", "Key concept 2", "Key concept 3"],
  "explanation": "Educational context or explanation."
}}
"""
    else:  # long_answer
        prompt = f"""
You are generating exactly ONE B.Tech long-answer university exam question for CoursePilot.

SUBJECT: {request.subject_name}
SYLLABUS TYPE: {'Lab / Practical' if is_lab else 'Theory'}
SYLLABUS SCOPE: {scope_label}
DIFFICULTY: {chosen_difficulty.capitalize()}

SYLLABUS TOPIC CONTENT:
{context_str}
{used_str}
RULES:
1. Generate exactly ONE comprehensive, university-level long-answer exam question (testing deep architecture, mathematical derivations, algorithms, system design, or code implementations) strictly based on the syllabus content for {scope_label}.
2. Provide a detailed, well-structured expected answer.
3. Provide 3-5 comprehensive key grading criteria points.
4. Provide a detailed explanation.
5. Return raw JSON ONLY without any markdown backticks, markdown fences, or extra text.

JSON FORMAT:
{{
  "unit": "{scope_label}",
  "question_type": "long_answer",
  "difficulty": "{chosen_difficulty}",
  "question": "Comprehensive long-answer exam question text here?",
  "expected_answer": "Detailed, multi-part structured solution and explanation.",
  "key_points": ["Comprehensive criteria 1", "Comprehensive criteria 2", "Comprehensive criteria 3", "Comprehensive criteria 4"],
  "explanation": "Detailed theoretical and practical breakdown."
}}
"""

    models_to_try = [
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            raw_text = None
            if USE_NEW_SDK and client:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                raw_text = response.text
            elif api_key:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                raw_text = response.text

            if raw_text:
                cleaned = raw_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and "question" in parsed:
                    # Normalize parsed question fields
                    parsed["unit"] = parsed.get("unit") or scope_label
                    parsed["question_type"] = parsed.get("question_type") or q_type
                    parsed["difficulty"] = parsed.get("difficulty") or chosen_difficulty
                    if parsed.get("question_type") == "mcq" or "options" in parsed:
                        shuffle_mcq_options(parsed)
                    return {"question": parsed}
        except Exception as err:
            last_error = err
            logger.warning(f"Model {model_name} failed in generate_exam_question: {err}")

    # Fallback if Gemini fails or is unconfigured
    fallback_title = target_topics[0].get("topic_name", "Core Subject Topic") if target_topics else f"{request.subject_name} Topic"
    fallback_desc = target_topics[0].get("description", "") if target_topics else ""

    if q_type == "mcq":
        fallback_question = {
            "unit": scope_label,
            "question_type": "mcq",
            "difficulty": chosen_difficulty,
            "question": f"Which of the following statements best describes the core principle of {fallback_title} in {request.subject_name}?",
            "options": [
                f"It optimizes resource utilization and operational efficiency for {fallback_title}.",
                f"It eliminates all algorithmic time complexity in {request.subject_name}.",
                f"It replaces all underlying data structures with static arrays.",
                f"It is only applicable in legacy architectures without runtime execution."
            ],
            "correct_answer": 0,
            "explanation": f"{fallback_title} is designed to provide structured operational efficiency: {fallback_desc or 'Fundamental principle in curriculum.'}"
        }
        shuffle_mcq_options(fallback_question)
    elif q_type == "short_answer":
        fallback_question = {
            "unit": scope_label,
            "question_type": "short_answer",
            "difficulty": chosen_difficulty,
            "question": f"Define {fallback_title} and state its primary advantages in {request.subject_name}.",
            "expected_answer": f"{fallback_title} represents a fundamental component in {request.subject_name}. {fallback_desc or 'It ensures modular design, data integrity, and optimal problem-solving capability.'}",
            "key_points": [
                f"Core definition of {fallback_title}",
                "Key algorithmic/design advantages",
                "Practical application and implementation context"
            ],
            "explanation": f"Understanding {fallback_title} provides essential mastery for university examination."
        }
    else:
        fallback_question = {
            "unit": scope_label,
            "question_type": "long_answer",
            "difficulty": chosen_difficulty,
            "question": f"Explain the architectural design, algorithmic workflow, and practical use cases of {fallback_title} in {request.subject_name}. Provide relevant diagrams or schema specifications where applicable.",
            "expected_answer": f"{fallback_title} is comprehensive in {request.subject_name}.\n\n1. Theoretical Architecture: {fallback_desc or 'Core principles and definitions.'}\n2. Workflow: Systematic processing, state transitions, and complexity analysis.\n3. Practical Implementation: Real-world engineering trade-offs.",
            "key_points": [
                "Detailed architectural components and definitions",
                "Step-by-step algorithmic or workflow breakdown",
                "Complexity analysis and trade-offs",
                "Practical implementation and real-world relevance"
            ],
            "explanation": f"Comprehensive long-answer response covering theoretical and practical facets of {fallback_title}."
        }

    return {"question": fallback_question}


@app.post("/api/generate-quiz")
def generate_quiz(
    request: QuizRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    check_rate_limit(current_user.id, "generate_quiz", max_requests=25, window_seconds=60)
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
    ]

    last_error = None

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                return {"quiz": normalize_and_shuffle_quiz_json(response.text)}
            else:
                model = genai_legacy.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return {"quiz": normalize_and_shuffle_quiz_json(response.text)}
        except Exception as err:
            last_error = err

    raise HTTPException(
        status_code=500,
        detail="Topic quiz generation is currently unavailable. Please try again in a few moments.",
    )


@app.post("/api/study-advice")
def study_advice(
    request: StudyAdviceRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    check_rate_limit(current_user.id, "study_advice", max_requests=25, window_seconds=60)
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
def analyze_material(
    request: StudyMaterialRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    check_rate_limit(current_user.id, "analyze_material", max_requests=25, window_seconds=60)
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
    state: str
    user_id: Optional[str] = None
    redirect_uri: Optional[str] = None


class CalendarDisconnectRequest(BaseModel):
    user_id: Optional[str] = None


@app.get("/api/calendar/auth-url")
def get_calendar_auth_url(
    redirect_uri: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generates a secure Google OAuth 2.0 authorization URL requesting
    minimal read-only Calendar permissions with cryptographically signed HMAC state.
    """
    logger.info(f"[CALENDAR_OAUTH] auth-url endpoint reached for verified user={current_user.id[:8]}...")
    client_id = google_client_id

    if not client_id:
        logger.warning("[CALENDAR_OAUTH] GOOGLE_CLIENT_ID is not configured in backend environment variables.")
        return {
            "configured": False,
            "auth_url": None,
            "message": "Google Calendar OAuth client credentials are not configured on the backend.",
        }

    redirect = redirect_uri or google_redirect_uri or "https://ai-campus-copilot-one.vercel.app"
    scope = "https://www.googleapis.com/auth/calendar.events.readonly"

    # Cryptographically bind state token to verified user ID
    state_token = generate_oauth_state(current_user.id)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
        "state": state_token,
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    logger.info(f"[CALENDAR_OAUTH] Generated Google OAuth URL for user={current_user.id[:8]}")
    return {
        "configured": True,
        "auth_url": auth_url,
    }


@app.post("/api/calendar/oauth-callback")
async def calendar_oauth_callback(
    request: CalendarCallbackRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Exchanges Google authorization code for access & refresh tokens.
    Verifies HMAC state signature and stores encrypted tokens bound to verified user identity.
    """
    logger.info(f"[CALENDAR_OAUTH] oauth-callback endpoint reached for verified user={current_user.id[:8]}...")

    # 1. Verify OAuth State Signature & Binding
    is_valid, state_user = verify_oauth_state(request.state, expected_user_id=current_user.id)
    if not is_valid or state_user != current_user.id:
        logger.warning(f"[CALENDAR_OAUTH] State validation rejected for user {current_user.id}")
        raise HTTPException(
            status_code=400,
            detail="Invalid, expired, or tampered OAuth state parameter. Please restart calendar authorization.",
        )

    if not google_client_id or not google_client_secret:
        logger.error("[CALENDAR_OAUTH] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET on server.")
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

            # Store encrypted tokens securely on persistent storage
            save_calendar_tokens(current_user.id, {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "email": email,
                "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat(),
                "last_synced": datetime.now(timezone.utc).isoformat(),
            })

            return {
                "status": "connected",
                "email": email,
                "last_synced": datetime.now(timezone.utc).isoformat(),
            }
    except Exception as err:
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(status_code=500, detail=f"OAuth callback error: {str(err)}")


@app.get("/api/calendar/status")
def get_calendar_status(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Returns calendar connection status strictly for the authenticated student.
    Never exposes tokens or secrets.
    """
    connection = get_calendar_tokens(current_user.id)
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
async def get_calendar_events(current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Fetches calendar events for today strictly for the authenticated student,
    ignoring cancelled events and extracting only time blocks to derive availability.
    """
    connection = get_calendar_tokens(current_user.id)
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
                    save_calendar_tokens(current_user.id, connection)
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
            save_calendar_tokens(current_user.id, connection)

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
async def disconnect_calendar(
    request: Optional[CalendarDisconnectRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Safely disconnects Google Calendar and removes stored credentials strictly for the authenticated user.
    Preserves all existing CoursePilot student tasks and academic data.
    """
    connection = get_calendar_tokens(current_user.id)
    delete_calendar_tokens(current_user.id)

    if connection and connection.get("access_token"):
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
    user_id: Optional[str] = None


@app.post("/api/match-study-material")
async def match_study_material(
    request: MatchStudyMaterialRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Analyzes study material extracted text using Gemini AI and matches it
    against syllabus topics belonging to the material's specific subject and unit.
    Persists matches with match_score >= 60 in study_material_topics table.
    """
    check_rate_limit(current_user.id, "match_study_material", max_requests=20, window_seconds=60)
    logger.info(f"[TOPIC_MATCH] Request received for material_id={request.study_material_id}, user={current_user.id[:8]}...")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[TOPIC_MATCH] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Fetch study material and verify ownership
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[TOPIC_MATCH] Error querying study_materials: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(
            status_code=404,
            detail="This study material could not be found.",
        )

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this material.",
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
        logger.error(f"[TOPIC_MATCH] Error querying syllabus_topics: {err}")

    if not topics:
        return {
            "status": "success",
            "message": "No syllabus topics found for matching.",
            "matches": [],
            "matched_count": 0,
        }

    topics_summary = "\n".join([
        f"- ID: {t['id']} | Topic: {t['topic_name']} | Description: {t.get('description') or 'N/A'}"
        for t in topics[:25]
    ])

    prompt = f"""
You are an academic curriculum alignment AI analyzing educational course materials.

DOCUMENT TITLE: {material.get('title') or 'Study Material'}
DOCUMENT EXTRACTED TEXT (sample):
{extracted_text[:14000]}

SYLLABUS TOPICS TO MATCH AGAINST:
{topics_summary}

Determine which syllabus topics are covered in the document and assign a match relevance score from 0 to 100.
Only include matches with match_score >= 50.

Return JSON in this exact structure:
{{
  "matches": [
    {{
      "topic_id": 123,
      "topic_name": "Exact topic name",
      "match_score": 85,
      "explanation": "Brief explanation of why this topic matches."
    }}
  ]
}}
"""

    models_to_try = [
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
    ]

    matched_results = []
    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(model=model_name, contents=prompt)
                raw_text = resp.text
            else:
                mdl = genai_legacy.GenerativeModel(model_name)
                resp = mdl.generate_content(prompt)
                raw_text = resp.text

            clean_json = re.sub(r"^```json\s*", "", raw_text.strip())
            clean_json = re.sub(r"^```\s*", "", clean_json)
            clean_json = re.sub(r"\s*```$", "", clean_json)
            parsed = json.loads(clean_json)
            matched_results = parsed.get("matches", [])
            break
        except Exception as match_err:
            logger.warning(f"[TOPIC_MATCH] AI match try note: {match_err}")

    # Persist matches into study_material_topics
    filtered_matches = [m for m in matched_results if m.get("match_score", 0) >= 50]
    if filtered_matches:
        try:
            # Delete stale topic associations
            supabase_client.table("study_material_topics").delete().eq(
                "study_material_id", request.study_material_id
            ).execute()

            insert_payload = [
                {
                    "study_material_id": request.study_material_id,
                    "syllabus_topic_id": m["topic_id"],
                    "match_score": m.get("match_score", 75),
                    "coverage_type": "covered",
                }
                for m in filtered_matches
                if m.get("topic_id")
            ]
            if insert_payload:
                supabase_client.table("study_material_topics").insert(insert_payload).execute()
        except Exception as persist_err:
            logger.warning(f"[TOPIC_MATCH] Persist matches note: {persist_err}")

    return {
        "status": "success",
        "study_material_id": request.study_material_id,
        "matches": filtered_matches,
        "matched_count": len(filtered_matches),
    }


# ---------------------------------------------------------
# RAG INDEXING & SEMANTIC RETRIEVAL ENDPOINTS
# ---------------------------------------------------------

class IndexStudyMaterialRequest(BaseModel):
    study_material_id: int
    user_id: Optional[str] = None


@app.post("/api/index-study-material")
async def index_study_material(
    request: IndexStudyMaterialRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    RAG Chunking and Vector Embedding Pipeline.
    Chunks document text (~600-900 tokens with overlap), computes 768-dim embeddings,
    and stores them in study_material_chunks for high-speed semantic search.
    """
    check_rate_limit(current_user.id, "index_study_material", max_requests=15, window_seconds=60)
    logger.info(f"[RAG_INDEX] Indexing material_id={request.study_material_id}, user={current_user.id[:8]}...")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[RAG_INDEX] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Verify ownership and retrieve extracted text
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[RAG_INDEX] Query error: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="This study material could not be found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You don't have access to this material.")

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
    user_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=2000)
    action_type: str = Field("ask", max_length=50)


@app.post("/api/ask-study-material")
async def ask_study_material(
    request: AskStudyMaterialRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    RAG-powered AI Document Assistant.
    Retrieves top relevant chunks via vector similarity search and answers
    strictly grounded in the student's uploaded study material.
    """
    check_rate_limit(current_user.id, "ask_study_material", max_requests=30, window_seconds=60)
    logger.info(f"[RAG_QUERY] Action={request.action_type}, material_id={request.study_material_id}, user={current_user.id[:8]}...")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[RAG_QUERY] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Fetch study material and verify ownership
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[RAG_QUERY] Error querying study_materials: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(
            status_code=404,
            detail="This study material could not be found.",
        )

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this material.",
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
# AI STUDY PACK GENERATION & LLM JSON PARSER HELPERS
# ---------------------------------------------------------


def normalize_study_pack_schema(raw_data: dict) -> dict:
    """
    Guarantees that all fields required by study_packs table exist and have the right types.
    """
    if not isinstance(raw_data, dict):
        raw_data = {}

    summary = str(raw_data.get("summary") or "").strip()
    if not summary:
        summary = "Structured study summary extracted from the provided academic document."

    def ensure_str_list(val, default_item=""):
        if isinstance(val, list):
            res = [str(x).strip() for x in val if x and str(x).strip()]
            return res if res else ([default_item] if default_item else [])
        elif isinstance(val, str) and val.strip():
            return [val.strip()]
        return [default_item] if default_item else []

    key_concepts = ensure_str_list(raw_data.get("key_concepts"), "Core principles and topics")
    high_yield_points = ensure_str_list(raw_data.get("high_yield_points"), "Key exam takeaways")
    examples = ensure_str_list(raw_data.get("examples"), "Applied problems and illustrations")
    quick_revision = ensure_str_list(raw_data.get("quick_revision"), "Key revision checklist")

    # Normalize definitions
    raw_defs = raw_data.get("definitions") or []
    definitions = []
    if isinstance(raw_defs, list):
        for item in raw_defs:
            if isinstance(item, dict):
                term = str(item.get("term") or item.get("name") or "").strip()
                defn = str(item.get("definition") or item.get("meaning") or item.get("desc") or "").strip()
                if term or defn:
                    definitions.append({"term": term or "Key Term", "definition": defn or "Definition as per syllabus."})
            elif isinstance(item, str) and ":" in item:
                parts = item.split(":", 1)
                definitions.append({"term": parts[0].strip(), "definition": parts[1].strip()})
            elif isinstance(item, str) and item.strip():
                definitions.append({"term": item.strip(), "definition": "Academic definition."})
    elif isinstance(raw_defs, dict):
        for k, v in raw_defs.items():
            definitions.append({"term": str(k).strip(), "definition": str(v).strip()})

    # Normalize common confusions
    raw_conf = raw_data.get("common_confusions") or []
    common_confusions = []
    if isinstance(raw_conf, list):
        for item in raw_conf:
            if isinstance(item, dict):
                conf = str(item.get("confusion") or item.get("misconception") or item.get("term") or "").strip()
                clar = str(item.get("clarification") or item.get("resolution") or item.get("explanation") or "").strip()
                if conf or clar:
                    common_confusions.append({"confusion": conf or "Common Pitfall", "clarification": clar or "Careful distinction."})
            elif isinstance(item, str) and item.strip():
                common_confusions.append({"confusion": item.strip(), "clarification": "Review conceptual differences."})

    return {
        "summary": summary,
        "key_concepts": key_concepts,
        "definitions": definitions,
        "high_yield_points": high_yield_points,
        "common_confusions": common_confusions,
        "examples": examples,
        "quick_revision": quick_revision,
    }


class GenerateStudyPackRequest(BaseModel):
    study_material_id: int
    user_id: Optional[str] = None
    force_regenerate: bool = False


@app.post("/api/generate-study-pack")
async def generate_study_pack(
    request: GenerateStudyPackRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generates a structured, compact study pack grounded in the student's study material
    (summary, key concepts, definitions, high-yield points, common confusions, examples, quick revision).
    Uses cached study pack if available and force_regenerate is False.
    """
    check_rate_limit(current_user.id, "generate_study_pack", max_requests=10, window_seconds=60)
    logger.info(f"[STUDY_PACK] Request for material_id={request.study_material_id}, user={current_user.id[:8]}, force={request.force_regenerate}")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[STUDY_PACK] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text, updated_at"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[STUDY_PACK] Query study_materials error: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="This study material could not be found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You don't have access to this material.")

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

    # 5. Retrieve representative RAG chunks with balanced distribution
    retrieved_passages = []
    try:
        chunks_res = supabase_client.table("study_material_chunks").select(
            "chunk_index, content, page_number"
        ).eq("study_material_id", request.study_material_id).order("chunk_index").execute()
        
        all_chunks = chunks_res.data or []
        if all_chunks:
            if len(all_chunks) <= 15:
                selected_chunks = all_chunks
            else:
                # Evenly sample 15 chunks across start, middle, and end of document
                indices = [int(i * (len(all_chunks) - 1) / 14) for i in range(15)]
                selected_chunks = [all_chunks[i] for i in sorted(list(set(indices)))]
            
            retrieved_passages = [
                f"[Passage {c['chunk_index'] + 1} - Pg {c.get('page_number', 1)}]\n{c['content']}"
                for c in selected_chunks
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
            detail="The document was indexed, but no readable extracted text was found for the study pack.",
        )

    title = material.get("title", "Study Material")
    mat_type = material.get("material_type", "document")
    unit_str = f"Unit {material.get('unit_number')}" if material.get("unit_number") else "General Scope"

    # 6. Prompt Gemini for structured JSON Study Pack
    prompt = f"""
You are an expert academic study-pack generator for CoursePilot.
Create a comprehensive, high-yield study pack derived STRICTLY from the student's uploaded material below.

DOCUMENT TITLE: {title}
SUBJECT: {subject_name}
SCOPE / UNIT: {unit_str}
DOCUMENT TYPE: {mat_type}
MATCHED SYLLABUS TOPICS: {matched_topics_str}

RETRIEVED MATERIAL:
\"\"\"{source_context}\"\"\"

RULES:
- Derive all study content STRICTLY from the provided material without inventing facts.
- Do NOT assume this is a 4-unit theory syllabus. The document may be lecture notes, syllabus, lab manual, experiment sheet, question bank, or reference material. Adapt to the document's actual structure (e.g. practicals, steps, formulas, code).
- Preserve technical terms, definitions, theorems, formulas, and code/algorithm steps accurately.
- Keep explanations suitable and clear for a university B.Tech student.
- Return ONLY valid raw JSON matching the exact schema below, with NO markdown code fences or backticks.

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
      "confusion": "Common misconception or tricky distinction",
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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
            logger.warning(f"[STUDY_PACK] Model {model_name} failed: {err}")
            last_error = err

    if not response_text:
        logger.error(f"[STUDY_PACK] Gemini generation error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="The study pack could not be generated right now. Please try again.",
        )

    # 7. Robust parse and schema normalization
    try:
        raw_dict = parse_llm_json(response_text)
        normalized_pack = normalize_study_pack_schema(raw_dict)
    except Exception as parse_err:
        logger.error(f"[STUDY_PACK] JSON parse error: {parse_err}. Response snippet: {response_text[:300]}")
        try:
            repair_prompt = f"Fix and convert this text into valid JSON matching the schema:\n\n{response_text}"
            if USE_NEW_SDK:
                rep_resp = client.models.generate_content(
                    model="gemini-flash-lite-latest",
                    contents=repair_prompt,
                )
                raw_dict = parse_llm_json(rep_resp.text)
                normalized_pack = normalize_study_pack_schema(raw_dict)
            else:
                rep_model = genai_legacy.GenerativeModel("gemini-flash-lite-latest")
                rep_resp = rep_model.generate_content(repair_prompt)
                raw_dict = parse_llm_json(rep_resp.text)
                normalized_pack = normalize_study_pack_schema(raw_dict)
        except Exception as repair_err:
            logger.error(f"[STUDY_PACK] Secondary JSON repair failed: {repair_err}")
            raise HTTPException(
                status_code=500,
                detail="Could not structure study pack JSON. Please try again.",
            )

    # 8. Persist into study_packs table (Upsert)
    now_iso = datetime.now(timezone.utc).isoformat()
    db_payload = {
        "study_material_id": request.study_material_id,
        "user_id": current_user.id,
        "summary": normalized_pack["summary"],
        "key_concepts": normalized_pack["key_concepts"],
        "definitions": normalized_pack["definitions"],
        "high_yield_points": normalized_pack["high_yield_points"],
        "common_confusions": normalized_pack["common_confusions"],
        "examples": normalized_pack["examples"],
        "quick_revision": normalized_pack["quick_revision"],
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
    user_id: Optional[str] = None
    count: int = Field(15, ge=5, le=30)
    force_regenerate: bool = False


@app.post("/api/generate-flashcards")
async def generate_flashcards(
    request: GenerateFlashcardsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generates high-yield academic flashcards grounded in the student's study material
    using representative RAG passage chunks. Caches generated flashcards unless force_regenerate is True.
    """
    check_rate_limit(current_user.id, "generate_flashcards", max_requests=15, window_seconds=60)
    logger.info(f"[FLASHCARDS] Request for material_id={request.study_material_id}, user={current_user.id[:8]}, count={request.count}, force={request.force_regenerate}")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[FLASHCARDS] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[FLASHCARDS] Query error: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="This study material could not be found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You don't have access to this material.")

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
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
            logger.warning(f"[FLASHCARDS] Model {model_name} failed: {err}")
            last_error = err

    if not response_text:
        logger.error(f"[FLASHCARDS] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="Flashcard generation failed. Your study material is still safe.",
        )

    # 6. Parse and validate JSON
    try:
        cards_data = parse_llm_json(response_text)
        raw_cards = cards_data.get("flashcards", []) if isinstance(cards_data, dict) else (cards_data if isinstance(cards_data, list) else [])
        if not isinstance(raw_cards, list) or len(raw_cards) == 0:
            raise ValueError("No flashcards array in response.")
    except Exception as parse_err:
        logger.error(f"[FLASHCARDS] Parse error: {parse_err}. Response snippet: {response_text[:300]}")
        raise HTTPException(
            status_code=500,
            detail="Could not parse generated flashcards JSON. Please try again.",
        )

    # 7. Persist to study_flashcards table (Clean replace)
    now_iso = datetime.now(timezone.utc).isoformat()
    db_records = [
        {
            "study_material_id": request.study_material_id,
            "user_id": current_user.id,
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
    user_id: Optional[str] = None
    rating: str = Field(..., pattern="^(again|hard|good|easy)$")


@app.post("/api/review-flashcard")
async def review_flashcard(
    request: ReviewFlashcardRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Records a student's self-assessment review rating ('again', 'hard', 'good', 'easy')
    and updates the spaced-repetition next_review_at timestamp.
    """
    logger.info(f"[FLASHCARD_REVIEW] Card {request.flashcard_id}, rating={request.rating}, user={current_user.id[:8]}...")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[FLASHCARD_REVIEW] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=500,
            detail="Flashcard review could not access the database. Please try again.",
        )

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
    if str(card.get("user_id")) != str(current_user.id):
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
            "user_id": current_user.id,
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
    user_id: Optional[str] = None
    force_regenerate: bool = False


@app.post("/api/analyze-exam-paper")
async def analyze_exam_paper(
    request: AnalyzeExamPaperRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Analyzes an uploaded Previous-Year Question Paper, extracting question count,
    topic frequency, marks distribution, repeated concepts, question patterns, and revision priorities.
    Caches results unless force_regenerate is True.
    """
    check_rate_limit(current_user.id, "analyze_exam_paper", max_requests=10, window_seconds=60)
    logger.info(f"[EXAM_ANALYZER] Request for material_id={request.study_material_id}, user={current_user.id[:8]}, force={request.force_regenerate}")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[EXAM_ANALYZER] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    # 1. Verify user ownership of study_materials
    try:
        mat_res = supabase_client.table("study_materials").select(
            "id, user_id, title, subject_id, unit_number, material_type, extracted_text"
        ).eq("id", request.study_material_id).execute()
    except Exception as err:
        logger.error(f"[EXAM_ANALYZER] Query error: {err}")
        raise HTTPException(
            status_code=503,
            detail="The service is temporarily unavailable. Please try again in a moment.",
        )

    if not mat_res.data:
        raise HTTPException(status_code=404, detail="This study material could not be found.")

    material = mat_res.data[0]
    if str(material.get("user_id")) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You don't have access to this material.")

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

            top_res = supabase_client.table("syllabus_topics").select("id, topic_name, unit_number").eq("subject_id", material["subject_id"]).execute()
            if top_res.data:
                syllabus_topics_list = [f"Unit {t.get('unit_number', '?')}: {t['topic_name']}" for t in top_res.data]
        except Exception:
            pass

    syllabus_context = "\n".join(f"- {t}" for t in syllabus_topics_list[:30]) if syllabus_topics_list else "Standard B.Tech University Syllabus Topics"

    # 4. Retrieve RAG chunks or full extracted text
    retrieved_passages = []
    try:
        chunks_res = supabase_client.table("study_material_chunks").select(
            "chunk_index, content, page_number"
        ).eq("study_material_id", request.study_material_id).order("chunk_index").execute()
        all_chunks = chunks_res.data or []
        if all_chunks:
            if len(all_chunks) <= 15:
                selected_chunks = all_chunks
            else:
                indices = [int(i * (len(all_chunks) - 1) / 14) for i in range(15)]
                selected_chunks = [all_chunks[i] for i in sorted(list(set(indices)))]
            retrieved_passages = [f"[Page {c.get('page_number', 1)}]\n{c['content']}" for c in selected_chunks]
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
            detail="The question paper does not contain readable extracted text for analysis.",
        )

    title = material.get("title", "Question Paper")

    # 5. Prompt Gemini for Paper Analysis
    prompt = f"""
You are an expert exam analyzer for CoursePilot.
Analyze the uploaded Previous-Year Question Paper (PYQ) and extract structured insights for student exam preparation.

DOCUMENT: {title}
SUBJECT: {subject_name}
AVAILABLE SYLLABUS TOPICS:
{syllabus_context}

QUESTION PAPER CONTENT:
\"\"\"{source_context}\"\"\"

ANALYSIS OBJECTIVES:
1. Count the estimated total number of questions.
2. Identify which syllabus units / modules are tested (detected_units).
3. Topic frequency: which topics appear most often, with frequency count (1-5 scale) and estimated total marks.
4. Question patterns: extract notable recurring question structures (e.g. "Derive / Prove", "Differentiate between X and Y", "Design an algorithm", "Numerical problems").
5. Marks distribution: breakdown of questions by marks (e.g., "2-Mark Short Questions", "5-Mark Conceptual", "10-Mark Long/Numerical") with question count.
6. Difficulty breakdown: percentage distribution of easy, medium, hard questions (must sum to 100).
7. Repeated topics: list topics that have appeared across multiple sections/questions.
8. Revision priorities: top 5 high-yield topics the student MUST study first to maximize their score.

Return ONLY raw valid JSON matching the exact schema below, with NO markdown code fences or backticks.

REQUIRED JSON SCHEMA:
{{
  "total_questions": 12,
  "detected_units": ["Unit 1: Foundations", "Unit 2: Core Data Structures", "Unit 3: Advanced Trees"],
  "topic_frequency": [
    {{"topic_name": "AVL Tree Rotations", "frequency": 3, "estimated_marks": 15, "unit": "Unit 3"}},
    {{"topic_name": "Asymptotic Notations (Big-O)", "frequency": 2, "estimated_marks": 7, "unit": "Unit 1"}}
  ],
  "question_patterns": [
    {{"pattern_type": "Comparison & Distinction", "count": 4, "example_question": "Differentiate between BFS and DFS with time complexities."}},
    {{"pattern_type": "Numerical & Derivation", "count": 3, "example_question": "Construct an AVL tree for the following keys..."}}
  ],
  "marks_distribution": [
    {{"mark_tier": "2 Marks (Short Answer)", "question_count": 5}},
    {{"mark_tier": "5 Marks (Medium Analytical)", "question_count": 4}},
    {{"mark_tier": "10 Marks (Long Comprehensive)", "question_count": 3}}
  ],
  "difficulty_distribution": {{
    "easy_percent": 25,
    "medium_percent": 50,
    "hard_percent": 25
  }},
  "repeated_topics": [
    "Binary Search Tree Deletion",
    "Dijkstra's Algorithm"
  ],
  "revision_priorities": [
    "Master AVL Tree insertion and double rotations (high marks yield)",
    "Practice Graph Traversal algorithms (guaranteed long question)",
    "Review time complexities of sorting algorithms"
  ]
}}
"""

    models_to_try = [
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
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
            logger.warning(f"[EXAM_ANALYZER] Model {model_name} failed: {err}")
            last_error = err

    if not response_text:
        logger.error(f"[EXAM_ANALYZER] Gemini error: {last_error}")
        raise HTTPException(
            status_code=500,
            detail="The question paper is safely uploaded, but analysis could not be completed. Please try again.",
        )

    # 6. Parse and validate JSON
    try:
        analysis_data = parse_llm_json(response_text)
    except Exception as parse_err:
        logger.error(f"[EXAM_ANALYZER] Parse error: {parse_err}. Response snippet: {response_text[:300]}")
        raise HTTPException(
            status_code=500,
            detail="Could not structure paper analysis JSON. Please try again.",
        )

    # 7. Persist to exam_paper_analysis table
    now_iso = datetime.now(timezone.utc).isoformat()
    db_payload = {
        "study_material_id": request.study_material_id,
        "user_id": current_user.id,
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
    user_id: Optional[str] = None
    semester: Optional[int] = None
    section: Optional[str] = None
    limit: int = Field(25, ge=1, le=50)


@app.post("/api/academic-search")
async def academic_search(
    request: AcademicSearchRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Unified academic search combining deterministic keyword matching with semantic RAG
    across syllabus topics, study materials, previous-year question papers, flashcards, tasks, and exams.
    """
    check_rate_limit(current_user.id, "academic_search", max_requests=30, window_seconds=60)
    logger.info(f"[ACADEMIC_SEARCH] Query='{request.query[:30]}', user={current_user.id[:8]}..., sem={request.semester}")

    try:
        db_client = get_database_client()
    except Exception as db_err:
        logger.warning(f"[ACADEMIC_SEARCH] Database client unavailable: {db_err}")
        return {
            "status": "success",
            "query": request.query,
            "total_results": 0,
            "results": [],
        }

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
            supabase_client=db_client,
            query=request.query,
            user_id=current_user.id,
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
        return {
            "status": "success",
            "query": request.query,
            "total_results": 0,
            "results": [],
        }


# ---------------------------------------------------------
# AI STUDY COPILOT CHAT ENDPOINT
# ---------------------------------------------------------

class CopilotChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    conversation_id: Optional[int] = None


@app.post("/api/copilot-chat")
async def copilot_chat(
    request: CopilotChatRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Contextual AI Study Copilot chat endpoint.
    Retrieves real server-side academic context and RAG passages, executes intent routing,
    prompts Gemini for concise actionable responses with action buttons, and persists conversation.
    """
    check_rate_limit(current_user.id, "copilot_chat", max_requests=30, window_seconds=60)
    clean_msg = request.message.strip()
    if not clean_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info(f"[COPILOT_CHAT] User={current_user.id[:8]}..., conv={request.conversation_id}, msg='{clean_msg[:35]}'")

    try:
        supabase_client = get_database_client()
    except Exception as db_err:
        logger.error(f"[COPILOT_CHAT] Database client unavailable: {db_err}")
        raise HTTPException(
            status_code=500,
            detail="The study assistant is temporarily unable to access the database. Please try again.",
        )

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
            elif str(conv_res.data.get("user_id")) != str(current_user.id):
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
                "user_id": current_user.id,
                "title": title_snippet,
                "created_at": now_iso,
                "updated_at": now_iso,
            }).execute()
            if new_conv.data:
                conv_id = new_conv.data[0]["id"]
            else:
                conv_id = None
        except Exception as create_err:
            logger.warning(f"[COPILOT_CHAT] Conversation creation note: {create_err}")
            conv_id = None

    # 2. Gather Context & Academic Profile
    academic_context = "Academic Profile: University Student."
    try:
        from services.copilot_context import build_copilot_context
        ctx_obj = await build_copilot_context(
            supabase_client=supabase_client,
            user_id=current_user.id,
        )
        import json
        academic_context = json.dumps(ctx_obj, default=str)
    except Exception as ctx_err:
        logger.warning(f"[COPILOT_CHAT] Context gather note: {ctx_err}")

    # 3. Prompt Gemini Copilot
    prompt = f"""
You are the CoursePilot AI Academic Copilot.
Assist the university student with concise, highly actionable, academic guidance.

STUDENT ACADEMIC CONTEXT:
{academic_context}

USER MESSAGE:
{clean_msg}

INSTRUCTIONS:
1. Provide a direct, helpful, and concise answer (1-3 paragraphs or bullet points).
2. Ground your advice in their actual subjects, upcoming tasks, timetable, or uploaded documents if referenced in context.
3. Suggest up to 3 helpful action buttons the user can click next (e.g., "Review Today's Tasks", "Open Flashcards", "Practice Exam Quiz").
4. Return raw JSON only with NO markdown fences.

JSON format:
{{
  "message": "Assistant response text...",
  "actions": [
    {{"label": "Review Flashcards", "action": "open_flashcards"}},
    {{"label": "Start Study Session", "action": "start_timer"}}
  ]
}}
"""

    models_to_try = [
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-3.7-flash",
    ]

    assistant_msg = "I'm ready to help you with your coursework, syllabus topics, and exam revision."
    actions = []
    retrieved_sources = []

    for model_name in models_to_try:
        try:
            if USE_NEW_SDK:
                resp = client.models.generate_content(model=model_name, contents=prompt)
                raw_text = resp.text
            else:
                mdl = genai_legacy.GenerativeModel(model_name)
                resp = mdl.generate_content(prompt)
                raw_text = resp.text

            clean_json = re.sub(r"^```json\s*", "", raw_text.strip())
            clean_json = re.sub(r"^```\s*", "", clean_json)
            clean_json = re.sub(r"\s*```$", "", clean_json)
            parsed = json.loads(clean_json)
            assistant_msg = parsed.get("message", assistant_msg)
            actions = parsed.get("actions", [])
            break
        except Exception as chat_err:
            logger.warning(f"[COPILOT_CHAT] Chat model try note: {chat_err}")

    # 4. Save chat interaction if conversation exists
    if conv_id:
        try:
            supabase_client.table("copilot_messages").insert([
                {
                    "conversation_id": conv_id,
                    "sender": "user",
                    "content": clean_msg,
                    "created_at": now_iso,
                },
                {
                    "conversation_id": conv_id,
                    "sender": "assistant",
                    "content": assistant_msg,
                    "created_at": now_iso,
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


# ============================================================================
# SOCIAL LEARNING & XP ENDPOINTS
# ============================================================================

class XpAwardRequest(BaseModel):
    user_id: Optional[str] = None
    amount: int
    reason: str
    reference_type: str = "challenge"
    reference_id: str


@app.post("/api/xp/award")
async def award_xp_endpoint(
    request: XpAwardRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Idempotent server-side XP award endpoint.
    Guarantees that a challenge, quiz, or task awards XP exactly once per reference.
    """
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    clamped_amount = min(request.amount, 500)
    reference_key = f"{request.reference_type}_completion:{request.reference_id}"

    if supabase_client:
        try:
            existing = supabase_client.table("xp_transactions").select("id, amount").eq("reference_key", reference_key).execute()
            if existing.data and len(existing.data) > 0:
                return {
                    "status": "success",
                    "already_awarded": True,
                    "amount": existing.data[0]["amount"],
                    "reference_key": reference_key,
                }

            insert_res = supabase_client.table("xp_transactions").insert([
                {
                    "user_id": current_user.id,
                    "amount": clamped_amount,
                    "reason": request.reason,
                    "reference_type": request.reference_type,
                    "reference_id": request.reference_id,
                    "reference_key": reference_key,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            ]).execute()

            return {
                "status": "success",
                "already_awarded": False,
                "amount": clamped_amount,
                "reference_key": reference_key,
                "data": insert_res.data[0] if insert_res.data else None,
            }
        except Exception as err:
            logger.warning(f"[XP_AWARD] Database note: {err}")

    return {
        "status": "success",
        "already_awarded": False,
        "amount": clamped_amount,
        "reference_key": reference_key,
    }


# Persistent fast store for multi-device sync (XP, streak, avatar, challenge history)
USER_STATS_FILE = Path(__file__).resolve().parent / "user_stats_store.json"

def load_user_stats_from_disk() -> Dict[str, Dict[str, Any]]:
    if USER_STATS_FILE.exists():
        try:
            with open(USER_STATS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error reading user_stats_store.json: {e}")
    return {}

def save_user_stats_to_disk(store: Dict[str, Dict[str, Any]]):
    try:
        with open(USER_STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(store, f, indent=2)
    except Exception as e:
        logger.warning(f"Error writing user_stats_store.json: {e}")

CAMPUS_LEADERBOARD_STORE: Dict[str, Dict[str, Any]] = load_user_stats_from_disk()


class SyncUserStatsRequest(BaseModel):
    user_id: Optional[str] = None
    full_name: Optional[str] = "Student"
    public_display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    semester: Optional[int] = 3
    section: Optional[str] = "B2"
    total_xp: int = 0
    this_week_xp: int = 0
    streak: int = 0
    reputation: int = 91
    solved_count: int = 0
    xp_transactions: Optional[List[Dict[str, Any]]] = None
    challenge_history: Optional[List[Dict[str, Any]]] = None


@app.get("/api/user-stats/{user_id}")
async def get_user_stats(
    user_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Fetch a student's cloud-persisted learning progress, avatar, and XP to sync across any device.
    Strictly verifies authenticated identity matches requested user_id.
    """
    if str(user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied to this user profile.")

    stats = CAMPUS_LEADERBOARD_STORE.get(current_user.id)
    if not stats:
        return {"status": "not_found", "stats": None}
    return {"status": "success", "stats": stats}


@app.post("/api/sync-user-stats")
async def sync_user_stats(
    request: SyncUserStatsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Sync student learning stats, avatar, and progression across devices strictly for current_user.
    """
    user_id = current_user.id
    existing = CAMPUS_LEADERBOARD_STORE.get(user_id, {})
    
    # 1. Union and deduplicate XP transactions across all devices
    existing_txs = existing.get("xp_transactions", [])
    incoming_txs = request.xp_transactions or []

    tx_map = {}
    for tx in existing_txs:
        key = tx.get("reference_key") or tx.get("id") or f"{tx.get('reason')}_{tx.get('created_at')}"
        tx_map[key] = tx

    for tx in incoming_txs:
        key = tx.get("reference_key") or tx.get("id") or f"{tx.get('reason')}_{tx.get('created_at')}"
        tx_map[key] = tx

    merged_xp_txs = list(tx_map.values())
    computed_tx_xp = sum(int(tx.get("amount", 0)) for tx in merged_xp_txs)
    final_total_xp = max(computed_tx_xp, request.total_xp, existing.get("total_xp", 0))

    if final_total_xp > computed_tx_xp:
        remainder = final_total_xp - computed_tx_xp
        merged_xp_txs.append({
            "user_id": user_id,
            "amount": remainder,
            "reason": "Previous Progression Sync",
            "reference_key": f"legacy_sync_{user_id}_{final_total_xp}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        computed_tx_xp = final_total_xp

    # 2. Union challenge history across all devices
    existing_hist = existing.get("challenge_history", [])
    incoming_hist = request.challenge_history or []
    hist_map = {h.get("challenge_id"): h for h in existing_hist if h.get("challenge_id")}
    for h in incoming_hist:
        cid = h.get("challenge_id")
        if cid:
            if cid in hist_map and hist_map[cid].get("passed"):
                continue
            hist_map[cid] = h
    merged_history = list(hist_map.values())

    merged_avatar = request.avatar_url or existing.get("avatar_url")
    merged_name = request.public_display_name or existing.get("display_name") or request.full_name or f"Learner_{user_id[:6]}"

    CAMPUS_LEADERBOARD_STORE[user_id] = {
        "id": user_id,
        "full_name": request.full_name,
        "display_name": merged_name,
        "avatar_url": merged_avatar,
        "semester": request.semester or existing.get("semester", 3),
        "section": request.section or existing.get("section", "B2"),
        "total_xp": final_total_xp,
        "this_week_xp": max(request.this_week_xp, existing.get("this_week_xp", 0), final_total_xp),
        "streak": max(request.streak, existing.get("streak", 0)),
        "reputation": request.reputation or existing.get("reputation", 91),
        "solved_count": max(len([h for h in merged_history if h.get("passed")]), (final_total_xp // 25)),
        "xp_transactions": merged_xp_txs,
        "challenge_history": merged_history,
        "last_active": datetime.now(timezone.utc).isoformat(),
    }

    save_user_stats_to_disk(CAMPUS_LEADERBOARD_STORE)

    return {"status": "success", "synced": True, "stats": CAMPUS_LEADERBOARD_STORE[user_id]}


@app.get("/api/leaderboard")
async def get_campus_leaderboard(timeframe: str = "global"):
    """
    Retrieve real campus leaderboard across all registered students and active devices.
    Bypasses Supabase client-side RLS to return verified public learning profiles.
    """
    students_map: Dict[str, Dict[str, Any]] = {}

    # 1. Load all registered student profiles from Supabase database
    if supabase_client:
        try:
            res = supabase_client.table("student_profiles").select("id, full_name, semester, section").execute()
            if res.data:
                for row in res.data:
                    u_id = row.get("id")
                    if not u_id: continue
                    students_map[u_id] = {
                        "id": u_id,
                        "display_name": row.get("full_name") or f"Learner_{u_id[:6]}",
                        "avatar_url": None,
                        "semester": row.get("semester", 3),
                        "section": row.get("section", "B2"),
                        "xp": 0,
                        "this_week_xp": 0,
                        "streak": 0,
                        "reputation": 90,
                        "solved": 0,
                    }
        except Exception as e:
            logger.warning(f"[LEADERBOARD] Profile load note: {e}")

    # 2. Merge active live synced learning metrics from memory store
    for u_id, live_data in CAMPUS_LEADERBOARD_STORE.items():
        chosen_xp = live_data.get("this_week_xp", 0) if timeframe == "weekly" else live_data.get("total_xp", 0)
        students_map[u_id] = {
            "id": u_id,
            "display_name": live_data.get("display_name") or f"Learner_{u_id[:6]}",
            "avatar_url": live_data.get("avatar_url"),
            "semester": live_data.get("semester", 3),
            "section": live_data.get("section", "B2"),
            "xp": chosen_xp,
            "this_week_xp": live_data.get("this_week_xp", 0),
            "streak": live_data.get("streak", 0),
            "reputation": live_data.get("reputation", 91),
            "solved": live_data.get("solved_count", 0),
        }

    # 3. Sort deterministically by XP -> solved -> reputation
    ranked = list(students_map.values())
    ranked.sort(key=lambda s: (s.get("xp", 0), s.get("solved", 0), s.get("reputation", 0)), reverse=True)

    # Assign 1-indexed ranks
    for idx, item in enumerate(ranked):
        item["rank"] = idx + 1

    return {
        "status": "success",
        "timeframe": timeframe,
        "total_active_learners": len(ranked),
        "leaderboard": ranked,
    }

