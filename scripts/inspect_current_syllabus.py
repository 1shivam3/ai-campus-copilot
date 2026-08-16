import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
from supabase import create_client

sp = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

subs = sp.table("academic_subjects").select("id, subject_code, subject_name, subject_type").eq("semester", 3).eq("section", "B2").execute().data or []
print(f"Total subjects in Section B2: {len(subs)}\n")

for s in subs:
    tops = sp.table("syllabus_topics").select("id, unit_number, topic_name").eq("subject_id", s["id"]).execute().data or []
    code = s.get("subject_code") or "N/A"
    stype = s.get("subject_type") or "N/A"
    name = s.get("subject_name") or "N/A"
    print(f"{code:<12} | {stype:<10} | topics: {len(tops):<2} | {name}")
