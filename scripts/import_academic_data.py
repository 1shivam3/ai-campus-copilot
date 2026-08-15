import csv
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env or frontend/.env
load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / "frontend" / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    SUPABASE_URL = "https://zokjbhznksyqaisgwvcy.supabase.co"

if not SERVICE_ROLE_KEY:
    # If service role key is not yet set, warn the admin
    print("Warning: SUPABASE_SERVICE_ROLE_KEY is not set in backend/.env.")
    print("Using publishable key for read checks, but inserts with RLS require SUPABASE_SERVICE_ROLE_KEY.")
    SERVICE_ROLE_KEY = os.getenv("VITE_SUPABASE_KEY") or os.getenv("SUPABASE_KEY")

supabase = create_client(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
)


def read_csv(filename: str):
    path = ROOT / "academic-data" / filename

    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def import_subjects():
    rows = read_csv("subjects.csv")

    records = [
        {
            "semester": int(row["semester"]),
            "section": row["section"],
            "subject_code": row["subject_code"] or None,
            "subject_name": row["subject_name"],
            "subject_type": row.get("subject_type") or "Theory",
            "teacher_name": row.get("teacher_name") or None,
            "room": row.get("room") or None,
        }
        for row in rows
        if row.get("subject_name")
    ]

    if not records:
        print("No subject records found in subjects.csv.")
        return

    result = (
        supabase
        .table("academic_subjects")
        .insert(records)
        .execute()
    )

    print(f"Imported {len(result.data)} subjects.")


def import_timetable():
    rows = read_csv("timetable.csv")

    records = []

    for row in rows:
        subject_code = row.get("subject_code")
        if not subject_code:
            continue

        semester = int(row["semester"])
        section = row["section"]

        # Find matching subject id
        subject_res = (
            supabase
            .table("academic_subjects")
            .select("id")
            .eq("semester", semester)
            .eq("section", section)
            .eq("subject_code", subject_code)
            .limit(1)
            .execute()
        )

        if not subject_res.data:
            print(f"Notice: Subject {subject_code} (Sem {semester}, Sec {section}) not found in academic_subjects. Skipping.")
            continue

        subject_id = subject_res.data[0]["id"]

        records.append({
            "semester": semester,
            "section": section,
            "subject_id": subject_id,
            "day_of_week": row["day_of_week"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "room": row.get("room") or None,
            "teacher_name": row.get("teacher_name") or None,
        })

    if not records:
        print("No valid timetable records matched to subjects.")
        return

    result = (
        supabase
        .table("class_schedule")
        .insert(records)
        .execute()
    )

    print(f"Imported {len(result.data)} timetable classes.")


def import_labs():
    rows = read_csv("labs.csv")

    records = [
        {
            "semester": int(row["semester"]),
            "section": row["section"],
            "subject_name": row["subject_name"],
            "day_of_week": row["day_of_week"],
            "start_time": row["start_time"],
            "end_time": row["end_time"],
            "lab_room": row.get("lab_room") or None,
            "teacher_name": row.get("teacher_name") or None,
        }
        for row in rows
        if row.get("subject_name")
    ]

    if not records:
        print("No lab records found in labs.csv.")
        return

    result = (
        supabase
        .table("lab_schedule")
        .insert(records)
        .execute()
    )

    print(f"Imported {len(result.data)} lab records.")


def import_syllabus():
    rows = read_csv("syllabus.csv")

    records = []

    for row in rows:
        subject_code = row.get("subject_code")
        topic_name = row.get("topic_name")
        if not subject_code or not topic_name:
            continue

        semester = int(row["semester"])

        # Match subject by semester and subject_code
        subject_res = (
            supabase
            .table("academic_subjects")
            .select("id")
            .eq("semester", semester)
            .eq("subject_code", subject_code)
            .limit(1)
            .execute()
        )

        if not subject_res.data:
            print(f"Notice: Subject {subject_code} (Sem {semester}) not found for syllabus. Skipping.")
            continue

        subject_id = subject_res.data[0]["id"]

        records.append({
            "subject_id": subject_id,
            "unit_number": int(row["unit_number"]) if row.get("unit_number") else None,
            "topic_name": topic_name,
            "description": row.get("description") or None,
        })

    if not records:
        print("No valid syllabus records matched to subjects.")
        return

    result = (
        supabase
        .table("syllabus_topics")
        .insert(records)
        .execute()
    )

    print(f"Imported {len(result.data)} syllabus topics.")


if __name__ == "__main__":
    print("Starting academic data bulk import...")
    import_subjects()
    import_timetable()
    import_labs()
    import_syllabus()
    print("Academic import completed.")
