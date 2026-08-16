import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

def verify_database():
    print("=== Supabase Timetable Database Verification ===")
    
    # 1. Query class_schedule for semester 3
    q = supabase.table("class_schedule").select(
        "id,semester,section,day_of_week,start_time,end_time,room,teacher_name,subject_id,academic_subjects(subject_code,subject_name,subject_type)"
    ).eq("semester", 3).execute()
    rows = q.data
    
    print(f"Total Semester 3 records in DB: {len(rows)}")
    assert len(rows) == 600, f"Expected 600 records, got {len(rows)}"
    
    # 2. Distinct sections
    sections = sorted(list({r["section"] for r in rows}))
    print(f"Verified {len(sections)} distinct sections: {', '.join(sections)}")
    expected_secs = [
        "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2",
        "E1", "E2", "F1", "F2", "G1", "G2", "H1", "H2",
        "I1", "I2", "J1", "J2", "K1", "K2", "L1", "L2"
    ]
    assert sections == expected_secs, f"Section mismatch: {sections}"
    
    # 3. Duplicate slot check (section + day + start_time must be unique)
    slot_set = set()
    duplicates = []
    for r in rows:
        key = (r["section"], r["day_of_week"], r["start_time"])
        if key in slot_set:
            duplicates.append(key)
        slot_set.add(key)
    print(f"Duplicate timetable slots in DB: {len(duplicates)}")
    assert len(duplicates) == 0, f"Found duplicates: {duplicates}"
    
    # 4. Normalization check: BCSE-50lL vs BCSE-501L
    codes = [r["academic_subjects"]["subject_code"] for r in rows if r.get("academic_subjects")]
    assert "BCSE-50lL" not in codes, "Found invalid typo BCSE-50lL in database!"
    bcse_501l_count = sum(1 for c in codes if c == "BCSE-501L")
    print(f"BCSE-501L classes in DB (after 2-period merge): {bcse_501l_count} (merged from 48 periods)")
    
    # 5. Saturday & Friday check
    saturday_count = sum(1 for r in rows if r["day_of_week"].lower() == "saturday")
    friday_count = sum(1 for r in rows if r["day_of_week"].lower() == "friday")
    print(f"Saturday classes in DB: {saturday_count}")
    print(f"Friday classes in DB: {friday_count}")
    assert saturday_count == 0, "Found Saturday classes in DB!"
    assert friday_count > 0, "No Friday classes found in DB!"
    
    # 6. Detailed B2 check
    b2_records = [r for r in rows if r["section"] == "B2"]
    print(f"\nSection B2 records in DB: {len(b2_records)}")
    assert len(b2_records) == 25, f"Expected 25 records for B2, got {len(b2_records)}"
    
    print("\nSample B2 Schedule Verification:")
    for r in sorted(b2_records, key=lambda x: (x["day_of_week"], x["start_time"])):
        subj = r["academic_subjects"]
        print(f"  {r['day_of_week'][:3]} {r['start_time'][:5]}-{r['end_time'][:5]} | {subj['subject_code']} - {subj['subject_name']} | Room: {r['room']} | Teacher: {r['teacher_name']}")

    print("\n>>> ALL DATABASE VERIFICATIONS PASSED (100%) <<<")

if __name__ == "__main__":
    verify_database()
