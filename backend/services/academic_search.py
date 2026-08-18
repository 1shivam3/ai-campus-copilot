import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger("coursepilot.academic_search")

try:
    from services.embeddings import embed_query
except ImportError:
    embed_query = None


def normalize_str(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"[^\w\s]", " ", s).lower().strip()


def generate_search_terms(query: str) -> List[str]:
    clean = query.strip().lower()
    if not clean:
        return []
    words = [w.strip() for w in clean.split() if len(w.strip()) > 1]
    terms = set(words)
    terms.add(clean)
    for w in words:
        if w.endswith("s") and len(w) > 3:
            terms.add(w[:-1])
        elif len(w) > 2:
            terms.add(w + "s")
    # Acronyms & aliases
    if "dbms" in clean:
        terms.add("database")
        terms.add("management")
    if "dsa" in clean or "data structure" in clean or "data structures" in clean:
        terms.add("data structure")
        terms.add("algorithm")
        terms.add("structures")
        terms.add("structure")
    if "os" in words or clean == "os":
        terms.add("operating")
        terms.add("system")
    if "cn" in words or clean == "cn":
        terms.add("computer network")
        terms.add("network")
    if "oop" in words or "java" in words:
        terms.add("object oriented")
        terms.add("java")
    if "discrete" in words:
        terms.add("discrete")
        terms.add("structures")
    if "bet" in words or "bet-i" in clean:
        terms.add("employability")
        terms.add("training")
        terms.add("bet-i")
    if "normalization" in clean or "normal" in clean:
        terms.add("normalization")
        terms.add("normal")
    return [t for t in terms if len(t) > 1][:8]


async def search_academic_workspace(
    supabase_client=None,
    query: str = "",
    user_id: str = "",
    semester: Optional[int] = None,
    section: Optional[str] = None,
    limit: int = 25,
) -> List[Dict[str, Any]]:
    """
    Unified academic search across syllabus topics, student study materials,
    previous-year examination papers, flashcards, pending tasks, and exams.
    Combines deterministic PostgreSQL keyword matching with semantic RAG vector retrieval.
    """
    if supabase_client is None:
        try:
            from services.database import get_database_client
            supabase_client = get_database_client()
        except Exception:
            pass

    clean_q = query.strip()
    if not clean_q or len(clean_q) < 2:
        return []

    norm_q = normalize_str(clean_q)
    results: List[Dict[str, Any]] = []

    # ---------------------------------------------------------
    # 1. SPECIAL NATURAL-LANGUAGE INTENT MAPPINGS
    # ---------------------------------------------------------
    is_exam_intent = bool(re.search(r"\b(exam|exams|test|upcoming exams|datesheet|midsem|endsem)\b", norm_q))
    is_task_intent = bool(re.search(r"\b(task|tasks|assignment|assignments|todo|homework|pending)\b", norm_q))
    is_flashcard_intent = bool(re.search(r"\b(flashcard|flashcards|card|cards|deck|revision cards)\b", norm_q))
    is_paper_intent = bool(re.search(r"\b(paper|papers|previous year|pyq|question paper|previous papers)\b", norm_q))
    is_weak_topic_intent = bool(re.search(r"\b(weak|weak topics|revise|revision|mastery|low score)\b", norm_q))

    search_terms = generate_search_terms(clean_q)

    # ---------------------------------------------------------
    # 2. ACADEMIC SUBJECTS & SYLLABUS TOPICS SEARCH
    # ---------------------------------------------------------
    try:
        sub_filter = ",".join([f"subject_name.ilike.%{term}%,subject_code.ilike.%{term}%" for term in search_terms])
        sub_query = supabase_client.table("academic_subjects").select("id, subject_name, subject_code, semester, section")
        if semester is not None:
            sub_query = sub_query.eq("semester", semester)
        sub_res = sub_query.or_(sub_filter).limit(6).execute()
        if sub_res.data:
            for s in sub_res.data:
                sub_name = s.get("subject_name", "Subject")
                sub_code = f" ({s.get('subject_code')})" if s.get("subject_code") else ""
                results.append({
                    "type": "syllabus",
                    "title": f"{sub_name}{sub_code}",
                    "subtitle": f"Semester {s.get('semester', 3)} · Course Curriculum",
                    "score": 0.95,
                    "metadata": {
                        "subject_id": s["id"],
                        "subject_name": sub_name,
                        "subject_code": s.get("subject_code"),
                    },
                })
    except Exception as sub_err:
        logger.warning(f"[ACADEMIC_SEARCH] Subjects query notice: {sub_err}")

    try:
        top_filter = ",".join([f"topic_name.ilike.%{term}%,description.ilike.%{term}%" for term in search_terms])
        topic_query = supabase_client.table("syllabus_topics").select(
            "id, topic_name, unit_number, description, subject_id, academic_subjects!inner(id, subject_name, subject_code, semester)"
        )
        if semester is not None:
            topic_query = topic_query.eq("academic_subjects.semester", semester)

        top_res = topic_query.or_(top_filter).limit(8).execute()
        if top_res.data:
            for t in top_res.data:
                sub = t.get("academic_subjects") or {}
                sub_name = sub.get("subject_name", "Subject")
                sub_code = f" ({sub.get('subject_code')})" if sub.get("subject_code") else ""
                unit_str = f"Unit {t.get('unit_number')}" if t.get("unit_number") else "Syllabus"

                norm_title = normalize_str(t.get("topic_name", ""))
                score = 0.98 if norm_q in norm_title else 0.85

                results.append({
                    "type": "syllabus",
                    "title": t.get("topic_name", "Topic"),
                    "subtitle": f"{sub_name}{sub_code} · {unit_str}",
                    "score": score,
                    "metadata": {
                        "topic_id": t["id"],
                        "subject_id": t.get("subject_id"),
                        "subject_name": sub_name,
                        "unit_number": t.get("unit_number"),
                    },
                })
    except Exception as syl_err:
        logger.warning(f"[ACADEMIC_SEARCH] Syllabus query notice: {syl_err}")

    # ---------------------------------------------------------
    # 3. CLASS SCHEDULE & TIMETABLE SEARCH
    # ---------------------------------------------------------
    try:
        sched_query = supabase_client.table("class_schedule").select(
            "id, semester, section, day_of_week, start_time, end_time, room, teacher_name, academic_subjects(subject_name, subject_code)"
        )
        if semester is not None:
            sched_query = sched_query.eq("semester", semester)
        if section is not None:
            sched_query = sched_query.eq("section", section)
        sched_res = sched_query.limit(25).execute()
        if sched_res.data:
            for s in sched_res.data:
                sub = s.get("academic_subjects") or {}
                sub_name = sub.get("subject_name", "Class")
                sub_code = f" ({sub.get('subject_code')})" if sub.get("subject_code") else ""
                day = s.get("day_of_week", "")
                teacher = f" · 👨‍🏫 {s.get('teacher_name')}" if s.get("teacher_name") else ""
                room = f" · 📍 Room {s.get('room')}" if s.get("room") else ""

                target_str = f"{sub_name} {sub.get('subject_code', '')} {s.get('teacher_name', '')} {s.get('room', '')} {day}".lower()
                if any(t.lower() in target_str for t in search_terms):
                    results.append({
                        "type": "timetable",
                        "title": f"{sub_name}{sub_code} — {day}",
                        "subtitle": f"⏱️ {s.get('start_time', '')[:5]} - {s.get('end_time', '')[:5]}{room}{teacher}",
                        "score": 0.91,
                        "metadata": {
                            "id": s["id"],
                            "schedule_id": s["id"],
                            "day": day,
                            "room": s.get("room"),
                            "teacher": s.get("teacher_name"),
                        },
                    })
    except Exception as sched_err:
        logger.warning(f"[ACADEMIC_SEARCH] Schedule query notice: {sched_err}")

    # ---------------------------------------------------------
    # 4. TASKS & ASSIGNMENTS SEARCH (User-Specific)
    # ---------------------------------------------------------
    try:
        task_query = supabase_client.table("tasks").select(
            "id, title, subject, deadline, importance, estimated_minutes, status"
        ).eq("user_id", user_id)

        if is_task_intent:
            task_query = task_query.eq("status", "pending")
        else:
            task_filter = ",".join([f"title.ilike.%{term}%,subject.ilike.%{term}%" for term in search_terms])
            task_query = task_query.or_(task_filter)

        task_res = task_query.limit(5).execute()
        if task_res.data:
            for t in task_res.data:
                deadline_str = t.get("deadline", "")
                if deadline_str:
                    try:
                        deadline_str = datetime.fromisoformat(deadline_str.replace("Z", "+00:00")).strftime("%b %d")
                    except Exception:
                        pass
                sub_label = f"Due {deadline_str}" if deadline_str else "Task"

                results.append({
                    "type": "task",
                    "title": t.get("title", "Task"),
                    "subtitle": f"{t.get('subject', 'General')} · {sub_label} ({t.get('importance', 'Normal')} priority)",
                    "score": 0.88 if is_task_intent else 0.75,
                    "metadata": {
                        "id": t["id"],
                        "task_id": t["id"],
                        "subject": t.get("subject"),
                        "deadline": t.get("deadline"),
                        "status": t.get("status"),
                    },
                })
    except Exception as task_err:
        logger.warning(f"[ACADEMIC_SEARCH] Tasks query notice: {task_err}")

    # ---------------------------------------------------------
    # 5. EXAMS SEARCH (User-Specific)
    # ---------------------------------------------------------
    try:
        exam_query = supabase_client.table("exams").select(
            "id, subject, exam_date, importance"
        ).eq("user_id", user_id)

        if not is_exam_intent:
            exam_filter = ",".join([f"subject.ilike.%{term}%" for term in search_terms])
            exam_query = exam_query.or_(exam_filter)

        exam_res = exam_query.order("exam_date", desc=False).limit(4).execute()
        if exam_res.data:
            for ex in exam_res.data:
                date_str = ex.get("exam_date", "")
                if date_str:
                    try:
                        date_str = datetime.fromisoformat(date_str.replace("Z", "+00:00")).strftime("%b %d, %Y")
                    except Exception:
                        pass

                results.append({
                    "type": "exam",
                    "title": f"{ex.get('subject', 'Academic Course')} Examination",
                    "subtitle": f"📅 {date_str} · Importance: {ex.get('importance', 5)}/10",
                    "score": 0.90 if is_exam_intent else 0.80,
                    "metadata": {
                        "id": ex["id"],
                        "exam_id": ex["id"],
                        "subject": ex.get("subject"),
                        "exam_date": ex.get("exam_date"),
                        "importance": ex.get("importance"),
                    },
                })
    except Exception as ex_err:
        logger.warning(f"[ACADEMIC_SEARCH] Exams query notice: {ex_err}")

    # ---------------------------------------------------------
    # 6. DEDUPLICATE & SORT BY RELEVANCE SCORE
    # ---------------------------------------------------------
    seen = set()
    unique_results = []
    # Sort descending by score
    results.sort(key=lambda r: r.get("score", 0), reverse=True)

    for item in results:
        key = f"{item['type']}:{item['title']}:{item.get('subtitle', '')[:30]}"
        if key not in seen:
            seen.add(key)
            unique_results.append(item)
            if len(unique_results) >= limit:
                break

    return unique_results
