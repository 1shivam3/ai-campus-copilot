import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("backend/.env")
url = os.getenv("VITE_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

res = supabase.from_("academic_subjects").select("*").eq("semester", 3).execute()
print(f"Total academic_subjects for semester 3: {len(res.data)}")
subjects = set()
for row in res.data:
    subjects.add((row["section"], row["subject_code"], row["subject_name"], row["id"]))

for s in sorted(subjects):
    print(s)
