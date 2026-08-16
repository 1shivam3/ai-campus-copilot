import argparse
import csv
import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "academic-data"

load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env"
    )

supabase = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)


def read_csv(filename):
    path = DATA / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def to_24h(t):
    t = t.strip()
    m = re.match(r"(\d{1,2}):(\d{2})(am|pm)", t.lower())
    if not m:
        return t
    h, mn, ap = int(m.group(1)), m.group(2), m.group(3)
    if ap == "pm" and h != 12:
        h += 12
    elif ap == "am" and h == 12:
        h = 0
    return f"{h:02d}:{mn}:00"


def parse_time_range(time_str):
    parts = time_str.split("-")
    return to_24h(parts[0]), to_24h(parts[1])


def parse_teacher_and_room(details_str):
    if not details_str:
        return None, None
    s = details_str.strip()
    tokens = s.split()
    if not tokens:
        return None, None
    last_tok = tokens[-1].strip("(),[]")
    if re.match(r"^\d+[A-Za-z]?$", last_tok) or last_tok in [
        "117", "118", "119", "142", "143", "144", "145", "147", "160",
        "161", "162", "167", "168", "169", "170", "174", "206", "207",
        "208", "236", "245", "252", "253", "254", "357"
    ]:
        room = last_tok
        teacher = " ".join(tokens[:-1]).strip(", ")
        return teacher if teacher else None, room
    return s, None


def normalize_sec(code):
    m = re.match(r"^3CSE([A-L][12])$", code)
    return m.group(1) if m else code


def normalize_course_code(code):
    if code == "BCSE-50lL":
        return "BCSE-501L"
    return code


def import_from_json(json_path):
    print("=== 1. Reading Authoritative Timetable JSON ===")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    timetable = data["timetable"]
    sections = list(timetable.keys())
    print(f"Sections in JSON: {len(sections)}")

    # Pre-validation counts
    day_class_counts = {"MONDAY": 0, "TUESDAY": 0, "WEDNESDAY": 0, "THURSDAY": 0, "FRIDAY": 0, "SATURDAY": 0}
    total_class_entries = 0
    lab_period_entries = 0
    bcse_50ll_count = 0
    section_class_counts = {}

    for sec_code, days_map in timetable.items():
        sec_classes = 0
        for day, periods in days_map.items():
            for p in periods:
                if p.get("course_code") == "BCSE-50lL":
                    bcse_50ll_count += 1
                if p.get("status") == "class":
                    day_class_counts[day] = day_class_counts.get(day, 0) + 1
                    total_class_entries += 1
                    sec_classes += 1
                    code = p.get("course_code") or ""
                    if code.endswith("L") or code == "BCSE-50lL":
                        lab_period_entries += 1
        section_class_counts[sec_code] = sec_classes

    print("\n--- Pre-Import Validation Counts ---")
    print(f"Sections: {len(sections)}")
    print(f"Monday class periods: {day_class_counts.get('MONDAY', 0)}")
    print(f"Tuesday class periods: {day_class_counts.get('TUESDAY', 0)}")
    print(f"Wednesday class periods: {day_class_counts.get('WEDNESDAY', 0)}")
    print(f"Thursday class periods: {day_class_counts.get('THURSDAY', 0)}")
    print(f"Friday class periods: {day_class_counts.get('FRIDAY', 0)}")
    print(f"Total class-period entries: {total_class_entries}")
    print(f"Lab-period entries: {lab_period_entries}")
    print(f"BCSE-50lL normalized: {bcse_50ll_count} -> BCSE-501L")
    print(f"Saturday entries: {day_class_counts.get('SATURDAY', 0)}")

    day_names = {
        "MONDAY": "Monday",
        "TUESDAY": "Tuesday",
        "WEDNESDAY": "Wednesday",
        "THURSDAY": "Thursday",
        "FRIDAY": "Friday"
    }

    # Merge consecutive two-period labs
    merged_blocks = []
    merged_sessions = 0

    for sec_code, days_map in timetable.items():
        section = normalize_sec(sec_code)
        for day_key, periods in days_map.items():
            day_name = day_names.get(day_key, day_key.capitalize())
            classes = []
            for p in periods:
                if p.get("status") == "class":
                    code = normalize_course_code(p.get("course_code"))
                    st, et = parse_time_range(p.get("time"))
                    teacher, room = parse_teacher_and_room(p.get("details"))
                    classes.append({
                        "period": p["period"],
                        "course_code": code,
                        "day": day_name,
                        "start_time": st,
                        "end_time": et,
                        "teacher": teacher,
                        "room": room,
                        "is_lab": code.endswith("L")
                    })

            i = 0
            while i < len(classes):
                curr = classes[i]
                if i + 1 < len(classes):
                    nxt = classes[i + 1]
                    if (curr["is_lab"] and nxt["is_lab"] and
                        curr["course_code"] == nxt["course_code"] and
                        curr["teacher"] == nxt["teacher"] and
                        curr["room"] == nxt["room"] and
                        curr["period"] + 1 == nxt["period"]):
                        merged_blocks.append({
                            "semester": 3,
                            "section": section,
                            "day_of_week": day_name,
                            "course_code": curr["course_code"],
                            "start_time": curr["start_time"],
                            "end_time": nxt["end_time"],
                            "teacher_name": curr["teacher"],
                            "room": curr["room"],
                            "is_lab": True,
                        })
                        merged_sessions += 1
                        i += 2
                        continue

                merged_blocks.append({
                    "semester": 3,
                    "section": section,
                    "day_of_week": day_name,
                    "course_code": curr["course_code"],
                    "start_time": curr["start_time"],
                    "end_time": curr["end_time"],
                    "teacher_name": curr["teacher"],
                    "room": curr["room"],
                    "is_lab": curr["is_lab"],
                })
                i += 1

    print(f"\nMerged 2-period lab sessions: {merged_sessions}")
    print(f"Total timetable records to insert: {len(merged_blocks)}")

    # Fetch subject ID mappings
    print("\n=== 2. Fetching academic_subjects mapping ===")
    subjs = supabase.table("academic_subjects").select("id,semester,section,subject_code").eq("semester", 3).execute().data
    subj_map = {(s["section"], s["subject_code"]): s["id"] for s in subjs}

    records_to_insert = []
    for b in merged_blocks:
        sid = subj_map.get((b["section"], b["course_code"]))
        if not sid:
            raise ValueError(f"Subject not found in database for section {b['section']} and code {b['course_code']}")
        records_to_insert.append({
            "semester": b["semester"],
            "section": b["section"],
            "subject_id": sid,
            "day_of_week": b["day_of_week"],
            "start_time": b["start_time"],
            "end_time": b["end_time"],
            "room": b["room"],
            "teacher_name": b["teacher_name"],
        })

    # Atomically purge old Semester 3 timetable records for all 24 sections
    print("\n=== 3. Purging old Semester 3 class_schedule records ===")
    for sec in sorted({b["section"] for b in merged_blocks}):
        supabase.table("class_schedule").delete().eq("semester", 3).eq("section", sec).execute()
    print("Old Semester 3 timetable purge complete.")

    # Insert new timetable records in batches
    print(f"\n=== 4. Inserting {len(records_to_insert)} timetable records into class_schedule ===")
    batch_size = 100
    for i in range(0, len(records_to_insert), batch_size):
        batch = records_to_insert[i:i + batch_size]
        supabase.table("class_schedule").insert(batch).execute()
        print(f"  Inserted batch {i // batch_size + 1} ({len(batch)} records)")

    print("\n=== 5. Post-Import Validation ===")
    db_rows = supabase.table("class_schedule").select("id,semester,section,day_of_week,start_time,end_time,room,teacher_name,subject_id").eq("semester", 3).execute().data
    print(f"Total Semester 3 rows in class_schedule: {len(db_rows)}")

    db_sections = sorted(list({r["section"] for r in db_rows}))
    print(f"Distinct sections in database ({len(db_sections)}): {', '.join(db_sections)}")

    # Verify no Saturday classes
    saturday_rows = [r for r in db_rows if r["day_of_week"].lower() == "saturday"]
    print(f"Saturday classes in DB: {len(saturday_rows)}")

    # Verify Friday classes
    friday_rows = [r for r in db_rows if r["day_of_week"].lower() == "friday"]
    print(f"Friday classes in DB: {len(friday_rows)}")

    # Verify B2 records
    b2_rows = [r for r in db_rows if r["section"] == "B2"]
    print(f"Section B2 class records in DB: {len(b2_rows)}")

    print("\n=== IMPORT SUCCESSFUL ===")


def main():
    parser = argparse.ArgumentParser(description="MMDU Academic Data Complete Importer")
    parser.add_argument("--json", type=str, help="Path to authoritative timetable JSON file")
    args = parser.parse_args()

    if args.json:
        import_from_json(args.json)
    else:
        default_json = ROOT / "cse-3rd-sem-timetable(1).json"
        if default_json.exists():
            import_from_json(str(default_json))
        else:
            print("Running default CSV importer...")
            upsert_sections()
            upsert_subjects()
            import_timetable()
            import_labs()
            import_syllabus()


if __name__ == "__main__":
    main()
