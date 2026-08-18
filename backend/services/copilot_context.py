import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger("coursepilot.copilot_context")


def parse_time_minutes(time_str: str) -> int:
    """Converts '09:30' or '9:30 AM' to total minutes from midnight."""
    if not time_str:
        return 0
    try:
        clean = time_str.strip().upper()
        is_pm = "PM" in clean
        is_am = "AM" in clean
        clean = re.sub(r"[^\d:]", "", clean)
        parts = clean.split(":")
        hours = int(parts[0])
        mins = int(parts[1]) if len(parts) > 1 else 0

        if is_pm and hours < 12:
            hours += 12
        elif is_am and hours == 12:
            hours = 0

        return hours * 60 + mins
    except Exception:
        return 0


def format_minutes_time(mins: int) -> str:
    """Formats total minutes into '09:30 AM'."""
    h = (mins // 60) % 24
    m = mins % 60
    am_pm = "AM" if h < 12 else "PM"
    display_h = h if h <= 12 else h - 12
    if display_h == 0:
        display_h = 12
    return f"{display_h:02d}:{m:02d} {am_pm}"


async def build_copilot_context(supabase_client=None, user_id: str = "") -> Dict[str, Any]:
    """
    Builds a structured, authoritative, and compact academic context snapshot
    for the authenticated student to guide AI Copilot answers.
    """
    if supabase_client is None:
        try:
            from services.database import get_database_client
            supabase_client = get_database_client()
        except Exception:
            pass
    context: Dict[str, Any] = {
        "student": {
            "name": "Student",
            "semester": None,
            "section": None,
            "college": None,
        },
        "today": {
            "day_name": datetime.now().strftime("%A"),
            "date_str": datetime.now().strftime("%b %d, %Y"),
            "classes": [],
            "next_class": None,
            "free_windows": [],
        },
        "next_best_action": None,
        "exams": [],
        "tasks": [],
        "weak_topics": [],
        "attendance": {
            "overall_percentage": None,
            "at_risk_subjects": [],
        },
        "study_activity": {
            "today_minutes": 0,
            "weekly_minutes": 0,
        },
        "study_materials": [],
    }

    # 1. Fetch Student Profile
    try:
        prof_res = supabase_client.table("profiles").select(
            "full_name, semester, section, college_name"
        ).eq("id", user_id).maybe_single().execute()

        if prof_res.data:
            p = prof_res.data
            context["student"] = {
                "name": p.get("full_name") or "Student",
                "semester": p.get("semester"),
                "section": p.get("section"),
                "college": p.get("college_name"),
            }
    except Exception as prof_err:
        logger.warning(f"[COPILOT_CTX] Profile fetch note: {prof_err}")

    sem = context["student"]["semester"]
    sec = context["student"]["section"]
    today_day = datetime.now().strftime("%A")

    # 2. Fetch Today's Timetable & Compute Free Windows
    if sem:
        try:
            sched_query = supabase_client.table("class_schedule").select(
                "id, day_of_week, start_time, end_time, room, teacher_name, academic_subjects(subject_name, subject_code, subject_type)"
            ).eq("day_of_week", today_day).eq("semester", sem)

            if sec:
                sched_query = sched_query.eq("section", sec)

            sched_res = sched_query.order("start_time", desc=False).execute()
            classes = sched_res.data or []

            now_mins = datetime.now().hour * 60 + datetime.now().minute
            formatted_classes = []
            next_class_item = None

            for c in classes:
                start_m = parse_time_minutes(c.get("start_time", ""))
                end_m = parse_time_minutes(c.get("end_time", ""))
                sub = c.get("academic_subjects") or {}
                s_name = sub.get("subject_name") or c.get("subject_name", "Subject")
                s_code = sub.get("subject_code") or c.get("subject_code", "")
                c_type = sub.get("subject_type") or c.get("class_type", "Lecture")
                c_teacher = c.get("teacher_name") or sub.get("teacher_name", "Faculty not assigned")
                c_room = c.get("room") or sub.get("room", "")

                c_info = {
                    "subject": s_name,
                    "code": s_code,
                    "start_time": c.get("start_time", ""),
                    "end_time": c.get("end_time", ""),
                    "room": c_room,
                    "teacher": c_teacher,
                    "type": c_type,
                }
                formatted_classes.append(c_info)

                if start_m > now_mins and not next_class_item:
                    next_class_item = c_info

            context["today"]["classes"] = formatted_classes
            context["today"]["next_class"] = next_class_item

            # Compute free study windows between classes (>= 30 mins)
            free_windows = []
            for i in range(len(classes) - 1):
                cur_end = parse_time_minutes(classes[i].get("end_time", ""))
                nxt_start = parse_time_minutes(classes[i + 1].get("start_time", ""))
                gap = nxt_start - cur_end
                if gap >= 30:
                    free_windows.append({
                        "start": format_minutes_time(cur_end),
                        "end": format_minutes_time(nxt_start),
                        "duration_minutes": gap,
                    })

            context["today"]["free_windows"] = free_windows
        except Exception as sched_err:
            logger.warning(f"[COPILOT_CTX] Schedule fetch note: {sched_err}")

    # 3. Fetch Tasks (Pending, Missed, High Priority)
    try:
        tasks_res = supabase_client.table("tasks").select(
            "id, title, subject, deadline, importance, estimated_minutes, status"
        ).eq("user_id", user_id).eq("status", "pending").order("deadline", desc=False).limit(8).execute()

        now_utc = datetime.now(timezone.utc)
        parsed_tasks = []
        for t in (tasks_res.data or []):
            dl_str = t.get("deadline", "")
            days_left = None
            is_overdue = False
            if dl_str:
                try:
                    dt = datetime.fromisoformat(dl_str.replace("Z", "+00:00"))
                    diff = (dt.date() - now_utc.date()).days
                    days_left = diff
                    is_overdue = diff < 0
                except Exception:
                    pass

            parsed_tasks.append({
                "id": t["id"],
                "title": t.get("title"),
                "subject": t.get("subject"),
                "importance": t.get("importance", 5),
                "estimated_minutes": t.get("estimated_minutes", 30),
                "days_until_deadline": days_left,
                "is_overdue": is_overdue,
            })

        context["tasks"] = parsed_tasks
    except Exception as tasks_err:
        logger.warning(f"[COPILOT_CTX] Tasks fetch note: {tasks_err}")

    # 4. Fetch Upcoming Exams
    try:
        exams_res = supabase_client.table("exams").select(
            "id, subject, exam_date, importance"
        ).eq("user_id", user_id).gte(
            "exam_date", (datetime.now() - timedelta(days=1)).isoformat()
        ).order("exam_date", desc=False).limit(5).execute()

        parsed_exams = []
        for ex in (exams_res.data or []):
            ed_str = ex.get("exam_date", "")
            days_until = None
            if ed_str:
                try:
                    edt = datetime.fromisoformat(ed_str.replace("Z", "+00:00"))
                    days_until = max(0, (edt.date() - datetime.now().date()).days)
                except Exception:
                    pass

            parsed_exams.append({
                "id": ex["id"],
                "subject": ex.get("subject"),
                "days_remaining": days_until,
                "importance": ex.get("importance", 5),
            })

        context["exams"] = parsed_exams
    except Exception as exams_err:
        logger.warning(f"[COPILOT_CTX] Exams fetch note: {exams_err}")

    # 5. Fetch Weakest Topics (< 50% mastery score)
    try:
        prog_res = supabase_client.table("student_topic_progress").select(
            "syllabus_topic_id, mastery_score, syllabus_topics(topic_name, unit_number, academic_subjects(subject_name))"
        ).eq("user_id", user_id).lt("mastery_score", 55).order("mastery_score", desc=False).limit(6).execute()

        weak_list = []
        for p in (prog_res.data or []):
            top = p.get("syllabus_topics") or {}
            sub = (top.get("academic_subjects") or {}).get("subject_name", "Subject")
            weak_list.append({
                "topic": top.get("topic_name", "Topic"),
                "subject": sub,
                "unit": top.get("unit_number", 1),
                "mastery_score": p.get("mastery_score", 0),
            })

        context["weak_topics"] = weak_list
    except Exception as prog_err:
        logger.warning(f"[COPILOT_CTX] Progress fetch note: {prog_err}")

    # 6. Fetch Attendance Records & Risk
    try:
        att_res = supabase_client.table("attendance_records").select(
            "subject_name, status"
        ).eq("user_id", user_id).execute()

        records = att_res.data or []
        if records:
            subject_counts: Dict[str, Dict[str, int]] = {}
            total_present = 0
            for r in records:
                sname = r.get("subject_name", "General")
                if sname not in subject_counts:
                    subject_counts[sname] = {"present": 0, "total": 0}
                subject_counts[sname]["total"] += 1
                if r.get("status") in ["present", "Present", "P"]:
                    subject_counts[sname]["present"] += 1
                    total_present += 1

            total_all = len(records)
            overall_pct = round((total_present / total_all) * 100, 1) if total_all > 0 else None

            at_risk = []
            for sname, counts in subject_counts.items():
                if counts["total"] >= 3:
                    pct = (counts["present"] / counts["total"]) * 100
                    if pct < 75.0:
                        at_risk.append({
                            "subject": sname,
                            "percentage": round(pct, 1),
                            "attended": counts["present"],
                            "total": counts["total"],
                        })

            context["attendance"] = {
                "overall_percentage": overall_pct,
                "at_risk_subjects": at_risk,
            }
    except Exception as att_err:
        logger.warning(f"[COPILOT_CTX] Attendance fetch note: {att_err}")

    # 7. Fetch Study Activity (Focus Session Minutes)
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        week_start = (datetime.now() - timedelta(days=7)).isoformat()

        today_sess_res = supabase_client.table("study_sessions").select(
            "duration_minutes"
        ).eq("user_id", user_id).gte("created_at", today_start).execute()

        today_mins = sum([s.get("duration_minutes", 0) for s in (today_sess_res.data or [])])

        week_sess_res = supabase_client.table("study_sessions").select(
            "duration_minutes"
        ).eq("user_id", user_id).gte("created_at", week_start).execute()

        week_mins = sum([s.get("duration_minutes", 0) for s in (week_sess_res.data or [])])

        context["study_activity"] = {
            "today_minutes": today_mins,
            "weekly_minutes": week_mins,
        }
    except Exception as sess_err:
        logger.warning(f"[COPILOT_CTX] Sessions fetch note: {sess_err}")

    # 8. Fetch Uploaded Study Materials (Brief metadata)
    try:
        mats_res = supabase_client.table("study_materials").select(
            "id, title, material_type, unit_number, academic_subjects(subject_name)"
        ).eq("user_id", user_id).limit(8).execute()

        mats_list = []
        for m in (mats_res.data or []):
            sub = (m.get("academic_subjects") or {}).get("subject_name", "Academic Subject")
            mats_list.append({
                "id": m["id"],
                "title": m.get("title"),
                "type": m.get("material_type"),
                "subject": sub,
            })
        context["study_materials"] = mats_list
    except Exception as mats_err:
        logger.warning(f"[COPILOT_CTX] Materials fetch note: {mats_err}")

    # 9. Compute Deterministic Next Best Action
    if context["exams"] and context["exams"][0].get("days_remaining", 99) <= 3:
        nearest_exam = context["exams"][0]
        context["next_best_action"] = {
            "title": f"Revise for {nearest_exam['subject']} Exam",
            "reason": f"Exam is in {nearest_exam['days_remaining']} days. High revision priority.",
            "type": "open_exam_mode",
            "priority": "CRITICAL",
        }
    elif context["weak_topics"]:
        weakest = context["weak_topics"][0]
        context["next_best_action"] = {
            "title": f"Revise {weakest['topic']}",
            "reason": f"Weakest topic in {weakest['subject']} with only {weakest['mastery_score']}% mastery score.",
            "type": "start_focus",
            "topic": weakest["topic"],
            "priority": "HIGH",
        }
    elif context["tasks"]:
        top_task = context["tasks"][0]
        context["next_best_action"] = {
            "title": f"Complete {top_task['title']}",
            "reason": f"Pending task for {top_task['subject']}.",
            "type": "open_task",
            "task_id": top_task["id"],
            "priority": "HIGH",
        }
    else:
        context["next_best_action"] = {
            "title": "Review Today's Lecture Notes",
            "reason": "Consolidate today's learning before upcoming classes.",
            "type": "open_study_material",
            "priority": "NORMAL",
        }

    return context
