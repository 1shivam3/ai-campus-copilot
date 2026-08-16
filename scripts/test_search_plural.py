import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
from supabase import create_client

sp = create_client(os.getenv("VITE_SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

print("Query: Data Structures (plural)")
r1 = sp.table("academic_subjects").select("id, subject_name").ilike("subject_name", "%Data Structures%").execute()
print("  academic_subjects count:", len(r1.data or []))

print("\nQuery: Data Structure (singular)")
r2 = sp.table("academic_subjects").select("id, subject_name").ilike("subject_name", "%Data Structure%").execute()
print("  academic_subjects count:", len(r2.data or []))
