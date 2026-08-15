import csv
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "academic-data"

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / "frontend" / ".env")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or "https://zokjbhznksyqaisgwvcy.supabase.co"
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_SERVICE_ROLE_KEY in backend/.env. Please add it to backend/.env before running."
    )

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)


def read_csv(filename):
    path = DATA / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def upsert_sections():
    rows = read_csv("sections.csv")
    records = [{
        "semester": int(r["semester"]),
        "section": r["section"],
        "display_name": r["display_name"],
    } for r in rows]
    if records:
        supabase.table("academic_sections").upsert(
            records, on_conflict="semester,section"
        ).execute()
    print(f"Sections: {len(records)}")


def upsert_subjects():
    rows = read_csv("subjects.csv")
    records = [{
        "semester": int(r["semester"]),
        "section": r["section"],
        "subject_code": r["subject_code"] or None,
        "subject_name": r["subject_name"],
        "subject_type": r.get("subject_type") or "Theory",
        "teacher_name": r.get("teacher_name") or None,
        "room": r.get("room") or None,
    } for r in rows]
    if records:
        semesters = sorted({int(r["semester"]) for r in rows})
        sections = sorted({r["section"] for r in rows})
        for sem in semesters:
            for sec in sections:
                supabase.table("academic_subjects").delete().eq(
                    "semester", sem
                ).eq("section", sec).execute()
        supabase.table("academic_subjects").insert(records).execute()
    print(f"Subjects: {len(records)}")


def import_timetable():
    rows = read_csv("timetable.csv")
    sems = sorted({int(r["semester"]) for r in rows})
    secs = sorted({r["section"] for r in rows})
    for sem in sems:
        for sec in secs:
            supabase.table("class_schedule").delete().eq(
                "semester", sem
            ).eq("section", sec).execute()

    records = []
    missing = 0
    for r in rows:
        q = supabase.table("academic_subjects").select("id").eq(
            "semester", int(r["semester"])
        ).eq("section", r["section"]).eq(
            "subject_code", r["subject_code"]
        ).maybe_single().execute()

        subject = q.data
        if not subject:
            missing += 1
            continue

        records.append({
            "semester": int(r["semester"]),
            "section": r["section"],
            "subject_id": subject["id"],
            "day_of_week": r["day_of_week"],
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "room": r.get("room") or None,
            "teacher_name": r.get("teacher_name") or None,
        })

    if records:
        supabase.table("class_schedule").insert(records).execute()
    print(f"Timetable: {len(records)} imported; {missing} unmatched rows")


def import_labs():
    rows = read_csv("labs.csv")
    sems = sorted({int(r["semester"]) for r in rows})
    secs = sorted({r["section"] for r in rows})
    for sem in sems:
        for sec in secs:
            supabase.table("lab_schedule").delete().eq(
                "semester", sem
            ).eq("section", sec).execute()

    records = [{
        "semester": int(r["semester"]),
        "section": r["section"],
        "subject_name": r["subject_name"],
        "day_of_week": r["day_of_week"],
        "start_time": r["start_time"],
        "end_time": r["end_time"],
        "lab_room": r.get("lab_room") or None,
        "teacher_name": r.get("teacher_name") or None,
    } for r in rows]

    if records:
        supabase.table("lab_schedule").insert(records).execute()
    print(f"Labs: {len(records)}")


def import_syllabus():
    rows = read_csv("syllabus.csv")
    codes = sorted({r["subject_code"] for r in rows if r.get("subject_code")})
    for code in codes:
        q = supabase.table("academic_subjects").select("id").eq(
            "subject_code", code
        ).eq("semester", 3).execute()
        ids = [x["id"] for x in (q.data or [])]
        for sid in ids:
            supabase.table("syllabus_topics").delete().eq(
                "subject_id", sid
            ).execute()

    records = []
    unmatched = 0
    for r in rows:
        q = supabase.table("academic_subjects").select("id").eq(
            "semester", int(r["semester"])
        ).eq("subject_code", r["subject_code"]).limit(1).maybe_single().execute()

        subject = q.data
        if not subject:
            unmatched += 1
            continue

        records.append({
            "subject_id": subject["id"],
            "unit_number": int(r["unit_number"]) if r.get("unit_number") else None,
            "topic_name": r["topic_name"],
            "description": r.get("description") or None,
        })

    if records:
        supabase.table("syllabus_topics").insert(records).execute()
    print(f"Syllabus: {len(records)} imported; {unmatched} unmatched rows")


if __name__ == "__main__":
    print("=== MMDU 3rd Semester Academic Import ===")
    print("This uses the SUPABASE SERVICE ROLE KEY.")
    print("Run locally only. Never commit backend/.env.")
    upsert_sections()
    upsert_subjects()
    import_timetable()
    import_labs()
    import_syllabus()
    print("=== IMPORT COMPLETE ===")
