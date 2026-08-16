"""
CoursePilot Demo Data Seeder
Creates safe, realistic demo data for a student account (e.g. Semester 3, Section B2).
Usage: python scripts/seed_demo_data.py <USER_ID>
"""

import sys
import os
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_path, ".env"))

from supabase import create_client

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in backend/.env")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SERVICE_KEY)

def seed_user_demo_data(user_id: str):
    print(f"\n=======================================================")
    print(f"Seeding Demo Academic Data for User: {user_id}")
    print(f"=======================================================\n")

    now = datetime.now(timezone.utc)

    # 1. Profile Setup
    print("[1/6] Updating student profile (Sem 3, Sec B2)...")
    supabase.table("profiles").upsert({
        "id": user_id,
        "full_name": "Shivam Sharma (Demo)",
        "semester": 3,
        "section": "B2",
        "college_name": "Department of Computer Science & Engineering",
        "updated_at": now.isoformat(),
    }).execute()

    # 2. Seed Upcoming Exams
    print("[2/6] Seeding upcoming exams...")
    supabase.table("exams").insert([
        {
            "user_id": user_id,
            "subject": "Data Structures & Algorithms",
            "exam_date": (now + timedelta(days=3, hours=4)).isoformat(),
            "importance": "High",
        },
        {
            "user_id": user_id,
            "subject": "Database Management Systems",
            "exam_date": (now + timedelta(days=7, hours=2)).isoformat(),
            "importance": "High",
        },
        {
            "user_id": user_id,
            "subject": "Computer Organization & Architecture",
            "exam_date": (now + timedelta(days=12)).isoformat(),
            "importance": "Medium",
        }
    ]).execute()

    # 3. Seed Pending Tasks
    print("[3/6] Seeding pending assignments & tasks...")
    supabase.table("tasks").insert([
        {
            "user_id": user_id,
            "title": "Implement AVL Tree Self-Balancing Operations",
            "subject": "Data Structures & Algorithms",
            "deadline": (now + timedelta(hours=8)).isoformat(),
            "importance": "High",
            "estimated_minutes": 45,
            "status": "pending",
        },
        {
            "user_id": user_id,
            "title": "DBMS Lab 4: BCNF Normalization Practical Report",
            "subject": "Database Management Systems",
            "deadline": (now + timedelta(days=1, hours=6)).isoformat(),
            "importance": "High",
            "estimated_minutes": 60,
            "status": "pending",
        },
        {
            "user_id": user_id,
            "title": "COA Pipeline Hazard Simulation Exercises",
            "subject": "Computer Organization & Architecture",
            "deadline": (now + timedelta(days=2)).isoformat(),
            "importance": "Medium",
            "estimated_minutes": 30,
            "status": "pending",
        }
    ]).execute()

    # 4. Seed Topic Progress
    print("[4/6] Linking syllabus topic mastery progress...")
    topics_res = supabase.table("syllabus_topics").select("id, topic_name, unit_number").limit(10).execute()
    if topics_res.data:
        progress_rows = []
        mastery_levels = [25, 32, 45, 68, 74, 85, 90, 40, 55, 80]
        for idx, t in enumerate(topics_res.data):
            m_score = mastery_levels[idx % len(mastery_levels)]
            status = "mastered" if m_score >= 80 else ("in_progress" if m_score >= 40 else "needs_revision")
            progress_rows.append({
                "user_id": user_id,
                "syllabus_topic_id": t["id"],
                "mastery_score": m_score,
                "status": status,
                "updated_at": now.isoformat(),
            })
        supabase.table("student_topic_progress").upsert(progress_rows, on_conflict="user_id,syllabus_topic_id").execute()

    # 5. Seed Focus Sessions
    print("[5/6] Logging historical study focus sessions...")
    supabase.table("study_sessions").insert([
        {
            "user_id": user_id,
            "duration_minutes": 45,
            "completed": true,
            "created_at": (now - timedelta(hours=3)).isoformat(),
        },
        {
            "user_id": user_id,
            "duration_minutes": 30,
            "completed": true,
            "created_at": (now - timedelta(days=1, hours=2)).isoformat(),
        },
        {
            "user_id": user_id,
            "duration_minutes": 60,
            "completed": true,
            "created_at": (now - timedelta(days=2)).isoformat(),
        }
    ]).execute()

    # 6. Seed Attendance Records
    print("[6/6] Recording baseline subject attendance...")
    supabase.table("attendance_records").insert([
        {"user_id": user_id, "subject_name": "Data Structures & Algorithms", "status": "present", "class_date": (now - timedelta(days=1)).strftime("%Y-%m-%d")},
        {"user_id": user_id, "subject_name": "Data Structures & Algorithms", "status": "present", "class_date": (now - timedelta(days=2)).strftime("%Y-%m-%d")},
        {"user_id": user_id, "subject_name": "Database Management Systems", "status": "present", "class_date": (now - timedelta(days=1)).strftime("%Y-%m-%d")},
        {"user_id": user_id, "subject_name": "Computer Organization & Architecture", "status": "absent", "class_date": (now - timedelta(days=2)).strftime("%Y-%m-%d")},
        {"user_id": user_id, "subject_name": "Discrete Mathematics", "status": "present", "class_date": (now - timedelta(days=3)).strftime("%Y-%m-%d")},
    ]).execute()

    print("\n Demo academic data seeded successfully! You can now log into CoursePilot and demo seamlessly.\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_demo_data.py <USER_ID>")
        print("Example: python scripts/seed_demo_data.py a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        sys.exit(1)

    seed_user_demo_data(sys.argv[1].strip())
