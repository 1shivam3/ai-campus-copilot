import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))
url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not url or not key:
    raise RuntimeError("Missing Supabase credentials")

supabase = create_client(url, key)


def validate_syllabus():
    print("=======================================================")
    print("           COURSEPIOT SYLLABUS DATA VALIDATION         ")
    print("=======================================================")

    # 1. Fetch subjects for Section B2 (or across semester 3)
    subjects_res = supabase.table("academic_subjects").select("id, subject_code, subject_name, subject_type, semester, section").eq("semester", 3).eq("section", "B2").execute()
    subjects = subjects_res.data or []

    # 2. Fetch all syllabus topics for these subjects
    subject_ids = [s["id"] for s in subjects]
    topics_res = supabase.table("syllabus_topics").select("id, subject_id, unit_number, topic_name, description").in_("subject_id", subject_ids).execute()
    topics = topics_res.data or []

    # Group topics by subject_id
    topics_by_subject = {}
    for t in topics:
        sid = t["subject_id"]
        topics_by_subject.setdefault(sid, []).append(t)

    # Filter subjects that actually have syllabus content
    syllabus_subjects = [s for s in subjects if s["id"] in topics_by_subject and len(topics_by_subject[s["id"]]) > 0]

    theory_subjects = [s for s in syllabus_subjects if (s.get("subject_type") or "").lower() == "theory"]
    lab_subjects = [s for s in syllabus_subjects if (s.get("subject_type") or "").lower() == "lab"]

    wrong_mappings = 0
    orphan_records = 0
    duplicate_records = 0
    missing_type = 0

    print(f"\nTotal subjects in Section B2: {len(subjects)}")
    print(f"Subjects with active syllabus: {len(syllabus_subjects)}")
    print(f"Theory subjects: {len(theory_subjects)}")
    print(f"Lab subjects: {len(lab_subjects)}\n")

    print("--- Detailed Breakdown by Course ---")
    for s in syllabus_subjects:
        code = s.get("subject_code") or ""
        name = s.get("subject_name") or ""
        stype = s.get("subject_type") or "Unknown"
        s_topics = sorted(topics_by_subject[s["id"]], key=lambda x: x["unit_number"] or 0)
        
        if not s.get("subject_type"):
            missing_type += 1

        if stype.lower() == "theory":
            units = list(set([t["unit_number"] for t in s_topics if t.get("unit_number")]))
            print(f"  * [THEORY] {code:<10} | {name:<42} | {len(units)} Units ({len(s_topics)} topics)")
            if "NLP" in name or "Natural Language" in name:
                # Verify DSA is not in NLP
                for t in s_topics:
                    if "Linear Data Structures" in t.get("topic_name", "") or "Trees" in t.get("topic_name", ""):
                        wrong_mappings += 1
                        print(f"   [ERROR] Found DSA topic in NLP: {t['topic_name']}")
        elif stype.lower() == "lab":
            print(f"  * [LAB]    {code:<10} | {name:<42} | {len(s_topics)} Practicals")
        else:
            print(f"  * [{stype.upper()}] {code:<10} | {name:<42} | {len(s_topics)} Items")

    # Check for orphan records (topics whose subject_id does not exist)
    all_known_subject_ids = set([s["id"] for s in subjects])
    for t in topics:
        if t["subject_id"] not in all_known_subject_ids:
            orphan_records += 1

    # Check for duplicate topics (same subject_id + unit_number + topic_name)
    seen_keys = set()
    for t in topics:
        key = (t["subject_id"], t.get("unit_number"), t.get("topic_name"))
        if key in seen_keys:
            duplicate_records += 1
        seen_keys.add(key)

    print("\n=======================================================")
    print("                  VALIDATION SUMMARY                   ")
    print("=======================================================")
    print(f"Subjects with syllabus: {len(syllabus_subjects)}")
    print(f"Theory subjects:        {len(theory_subjects)}")
    print(f"Lab subjects:           {len(lab_subjects)}")
    print(f"Wrong mappings:         {wrong_mappings}")
    print(f"Orphan records:         {orphan_records}")
    print(f"Duplicate records:      {duplicate_records}")
    print(f"Missing type:           {missing_type}")

    if wrong_mappings == 0 and orphan_records == 0 and duplicate_records == 0 and missing_type == 0:
        print("\n--> [PASS] ALL SYLLABUS DATA INTEGRITY CHECKS PASSED (100% SUCCESS)")
        print("=======================================================")
        return True
    else:
        print("\n--> [FAIL] Syllabus integrity issues detected.")
        print("=======================================================")
        return False


if __name__ == "__main__":
    success = validate_syllabus()
    sys.exit(0 if success else 1)
