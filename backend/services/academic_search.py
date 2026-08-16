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
    supabase_client,
    query: str,
    user_id: str,
    semester: Optional[int] = None,
    limit: int = 25,
) -> List[Dict[str, Any]]:
    """
    Unified academic search across syllabus topics, student study materials,
    previous-year examination papers, flashcards, pending tasks, and exams.
    Combines deterministic PostgreSQL keyword matching with semantic RAG vector retrieval.
    """
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
    # 3. STUDY MATERIALS & PREVIOUS PAPERS (User-Specific Keyword Search)
    # ---------------------------------------------------------
    try:
        mat_filter = ",".join([f"title.ilike.%{term}%" for term in search_terms])
        mat_res = supabase_client.table("study_materials").select(
            "id, title, material_type, unit_number, original_file_name, academic_subjects(subject_name, subject_code)"
        ).eq("user_id", user_id).or_(mat_filter).limit(8).execute()

        if mat_res.data:
            for m in mat_res.data:
                sub = m.get("academic_subjects") or {}
                sub_name = sub.get("subject_name", "General")
                unit_str = f"Unit {m.get('unit_number')}" if m.get("unit_number") else "General"
                mat_type = m.get("material_type", "Study Material")
                is_paper = mat_type == "Previous Year Paper"

                norm_title = normalize_str(m.get("title", ""))
                score = 0.96 if norm_q in norm_title else 0.82

                results.append({
                    "type": "previous_paper" if is_paper else "study_material",
                    "title": m.get("title", "Document"),
                    "subtitle": f"{sub_name} · {unit_str} · {mat_type}",
                    "score": score,
                    "metadata": {
                        "id": m["id"],
                        "material_id": m["id"],
                        "material_type": mat_type,
                        "unit_number": m.get("unit_number"),
                    },
                })
    except Exception as mat_err:
        logger.warning(f"[ACADEMIC_SEARCH] Materials query notice: {mat_err}")

    # ---------------------------------------------------------
    # 4. FLASHCARDS SEARCH (User-Specific)
    # ---------------------------------------------------------
    try:
        fc_query = supabase_client.table("study_flashcards").select(
            "id, question, answer, topic_name, difficulty, study_material_id, study_materials(title)"
        ).eq("user_id", user_id)

        if not is_flashcard_intent:
            fc_filter = ",".join([f"question.ilike.%{term}%,answer.ilike.%{term}%,topic_name.ilike.%{term}%" for term in search_terms])
            fc_query = fc_query.or_(fc_filter)

        fc_res = fc_query.limit(6).execute()
        if fc_res.data:
            for fc in fc_res.data:
                doc_title = (fc.get("study_materials") or {}).get("title", "Flashcard Deck")
                results.append({
                    "type": "flashcard",
                    "title": fc.get("question", "Flashcard Question"),
                    "subtitle": f"🏷️ {fc.get('topic_name', 'General')} · {doc_title}",
                    "score": 0.78,
                    "metadata": {
                        "id": fc["id"],
                        "flashcard_id": fc["id"],
                        "material_id": fc.get("study_material_id"),
                        "answer": fc.get("answer", ""),
                        "difficulty": fc.get("difficulty", "medium"),
                    },
                })
    except Exception as fc_err:
        logger.warning(f"[ACADEMIC_SEARCH] Flashcards query notice: {fc_err}")

    # ---------------------------------------------------------
    # 5. TASKS & ASSIGNMENTS SEARCH (User-Specific)
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
    # 6. EXAMS SEARCH (User-Specific)
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
    # 7. SEMANTIC RAG VECTOR RETRIEVAL (Content Passages in User's Study Materials)
    # ---------------------------------------------------------
    if embed_query and not (is_exam_intent or is_task_intent):
        try:
            q_emb = embed_query(clean_q)
            if q_emb and len(q_emb) == 768:
                # Retrieve matching chunks
                rpc_res = supabase_client.rpc(
                    "match_study_material_chunks",
                    {
                        "query_embedding": q_emb,
                        "match_threshold": 0.35,
                        "match_count": 5,
                        "target_study_material_id": None,
                    },
                ).execute()

                if rpc_res.data:
                    chunk_ids = [c["id"] for c in rpc_res.data if c.get("id")]
                    mat_ids = list(set([c["study_material_id"] for c in rpc_res.data if c.get("study_material_id")]))

                    # Verify ownership of retrieved materials
                    owned_mats_res = supabase_client.table("study_materials").select(
                        "id, title, material_type, unit_number, academic_subjects(subject_name, subject_code)"
                    ).in_("id", mat_ids).eq("user_id", user_id).execute()

                    owned_map = {m["id"]: m for m in (owned_mats_res.data or [])}

                    for chunk in rpc_res.data:
                        mid = chunk.get("study_material_id")
                        if mid in owned_map:
                            mat = owned_map[mid]
                            sub = mat.get("academic_subjects") or {}
                            sub_name = sub.get("subject_name", "Academic Notes")
                            is_paper = mat.get("material_type") == "Previous Year Paper"
                            sim = round(float(chunk.get("similarity", 0.7)), 2)

                            # Format passage snippet
                            snippet = chunk.get("content", "")
                            if len(snippet) > 120:
                                snippet = snippet[:117] + "..."

                            results.append({
                                "type": "previous_paper" if is_paper else "study_material",
                                "title": mat.get("title", "Study Note"),
                                "subtitle": f"Pg {chunk.get('page_number', 1)} · {sub_name} · {snippet}",
                                "score": sim,
                                "metadata": {
                                    "id": mat["id"],
                                    "material_id": mat["id"],
                                    "chunk_id": chunk.get("id"),
                                    "page_number": chunk.get("page_number", 1),
                                    "similarity": sim,
                                    "material_type": mat.get("material_type"),
                                },
                            })
        except Exception as sem_err:
            logger.warning(f"[ACADEMIC_SEARCH] Semantic vector retrieval notice: {sem_err}")

    # ---------------------------------------------------------
    # 8. DEDUPLICATE & SORT BY RELEVANCE SCORE
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
