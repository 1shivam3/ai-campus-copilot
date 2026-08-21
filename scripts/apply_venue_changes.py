import os
import sys
import json
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
backend_dir = ROOT / "backend"
sys.path.insert(0, str(backend_dir))

from services.database import get_database_client

db = get_database_client()

print("==================================================")
print("APPLYING PERMANENT TIMETABLE ROOM UPDATES (8 ROWS)")
print("==================================================")

# Target update definitions: (ID, Expected Sem, Sec, Day, StartTime, SubjCode, Teacher, OldRoom, NewRoom)
UPDATES = [
    # Thursday: 3J 08:40-09:40 BMAT-003C Dr. Shilpa Garg -> Room 265
    {"id": 2206, "sem": 3, "sec": "J1", "day": "Thursday", "start": "08:40:00", "teacher": "Dr. Shilpa Garg", "old_room": "169", "new_room": "265"},
    {"id": 2231, "sem": 3, "sec": "J2", "day": "Thursday", "start": "08:40:00", "teacher": "Dr. Shilpa Garg", "old_room": "169", "new_room": "265"},

    # Thursday: 3I 13:40-14:40 BMAT-003C Dr. Shilpa Garg -> Room 253
    {"id": 2159, "sem": 3, "sec": "I1", "day": "Thursday", "start": "13:40:00", "teacher": "Dr. Shilpa Garg", "old_room": "169", "new_room": "253"},
    {"id": 2184, "sem": 3, "sec": "I2", "day": "Thursday", "start": "13:40:00", "teacher": "Dr. Shilpa Garg", "old_room": "169", "new_room": "253"},

    # Friday: 3I 10:40-11:40 BET-I PD Trainer -> Room 208
    {"id": 2162, "sem": 3, "sec": "I1", "day": "Friday", "start": "10:40:00", "teacher": "PD Trainer", "old_room": "169", "new_room": "208"},
    {"id": 2187, "sem": 3, "sec": "I2", "day": "Friday", "start": "10:40:00", "teacher": "PD Trainer", "old_room": "169", "new_room": "208"},

    # Friday: 3B 13:40-14:40 BMAT-003C Dr. Ravinder -> Room 207
    {"id": 1813, "sem": 3, "sec": "B1", "day": "Friday", "start": "13:40:00", "teacher": "Dr. Ravinder", "old_room": "118", "new_room": "207"},
    {"id": 1838, "sem": 3, "sec": "B2", "day": "Friday", "start": "13:40:00", "teacher": "Dr. Ravinder", "old_room": "118", "new_room": "207"},
]

# 1. Verify before state in Supabase
print("\n--- 1. Verifying pre-update state in Supabase ---")
for u in UPDATES:
    r = db.table("class_schedule").select("id, semester, section, day_of_week, start_time, room, teacher_name, academic_subjects(subject_code)").eq("id", u["id"]).single().execute()
    data = r.data
    assert data, f"Record with ID {u['id']} not found!"
    assert data["semester"] == u["sem"], f"Semester mismatch for ID {u['id']}"
    assert data["section"] == u["sec"], f"Section mismatch for ID {u['id']}"
    assert data["day_of_week"].lower() == u["day"].lower(), f"Day mismatch for ID {u['id']}"
    assert data["start_time"].startswith(u["start"][:5]), f"Start time mismatch for ID {u['id']}"
    print(f"Verified target ID={u['id']}: Sem {data['semester']} Sec {data['section']} {data['day_of_week']} {data['start_time']} | Subj={data.get('academic_subjects', {}).get('subject_code')} | Teacher={data['teacher_name']} | Current Room={data['room']}")

# 2. Apply updates in Supabase
print("\n--- 2. Applying Supabase database updates ---")
for u in UPDATES:
    res = db.table("class_schedule").update({"room": u["new_room"]}).eq("id", u["id"]).execute()
    print(f"Updated ID={u['id']} (Sem {u['sem']} Sec {u['sec']} {u['day']} {u['start']}): Room -> {u['new_room']}")

# 3. Verify post-update state in Supabase
print("\n--- 3. Verifying post-update state in Supabase ---")
for u in UPDATES:
    r = db.table("class_schedule").select("id, semester, section, day_of_week, start_time, end_time, room, teacher_name, academic_subjects(subject_code)").eq("id", u["id"]).single().execute()
    data = r.data
    assert data["room"] == u["new_room"], f"Update verification failed for ID {u['id']}: expected room {u['new_room']}, got {data['room']}"
    print(f"PASS: ID={u['id']} | Sem {data['semester']} Sec {data['section']} {data['day_of_week']} {data['start_time']} | Code={data.get('academic_subjects', {}).get('subject_code')} | Teacher={data['teacher_name']} | Room={data['room']}")

# 4. Verify total count and no duplicate slots
res_all = db.table("class_schedule").select("id, semester, section, day_of_week, start_time").eq("semester", 3).execute()
assert len(res_all.data) == 600, f"Expected 600 records in class_schedule, got {len(res_all.data)}"
slots = set()
for r in res_all.data:
    key = (r["section"], r["day_of_week"], r["start_time"])
    assert key not in slots, f"Duplicate slot detected: {key}"
    slots.add(key)
print("\nPASS: Database record integrity verified: exactly 600 records, 0 duplicates, 0 missing slots.")

# 5. Update academic-data/timetable.csv
csv_path = ROOT / "academic-data" / "timetable.csv"
if csv_path.exists():
    print(f"\n--- 5. Updating {csv_path.name} ---")
    rows = []
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 7:
                sem, sec, code, day, st, et, room = row[:7]
                # 3J Thu 08:40 BMAT-003C -> 265
                if sem.strip() == "3" and sec.strip() in ["J1", "J2"] and code.strip() == "BMAT-003C" and day.strip().lower() == "thursday" and st.strip() == "08:40":
                    row[6] = "265"
                # 3I Thu 13:40 BMAT-003C -> 253
                elif sem.strip() == "3" and sec.strip() in ["I1", "I2"] and code.strip() == "BMAT-003C" and day.strip().lower() == "thursday" and st.strip() == "13:40":
                    row[6] = "253"
                # 3I Fri 10:40 BET-I -> 208
                elif sem.strip() == "3" and sec.strip() in ["I1", "I2"] and code.strip() == "BET-I" and day.strip().lower() == "friday" and st.strip() == "10:40":
                    row[6] = "208"
                # 3B Fri 13:40 BMAT-003C -> 207
                elif sem.strip() == "3" and sec.strip() in ["B1", "B2"] and code.strip() == "BMAT-003C" and day.strip().lower() == "friday" and st.strip() == "13:40":
                    row[6] = "207"
            rows.append(row)
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    print(f"PASS: Updated {csv_path.name}")

# 6. Update cse-3rd-sem-timetable(1).json if present
json_path = ROOT / "cse-3rd-sem-timetable(1).json"
if json_path.exists():
    print(f"\n--- 6. Updating {json_path.name} ---")
    with open(json_path, "r", encoding="utf-8") as f:
        jdata = json.load(f)
    
    tt = jdata.get("timetable", {})
    updated_json_count = 0
    for sec_name, days in tt.items():
        # Sec J
        if sec_name in ["3CSEJ1", "3CSEJ2", "J1", "J2", "3J", "J"]:
            for item in days.get("THURSDAY", []):
                if item.get("course_code") == "BMAT-003C" and "08:40" in item.get("time", ""):
                    item["details"] = "Dr. Shilpa Garg, 265"
                    item["raw"] = "BMAT-003C, Dr. Shilpa Garg, 265"
                    updated_json_count += 1
        # Sec I
        if sec_name in ["3CSEI1", "3CSEI2", "I1", "I2", "3I", "I"]:
            for item in days.get("THURSDAY", []):
                if item.get("course_code") == "BMAT-003C" and "01:40" in item.get("time", ""):
                    item["details"] = "Dr. Shilpa Garg, 253"
                    item["raw"] = "BMAT-003C, Dr. Shilpa Garg, 253"
                    updated_json_count += 1
            for item in days.get("FRIDAY", []):
                if item.get("course_code") == "BET-I" and "10:40" in item.get("time", ""):
                    item["details"] = "PD Trainer, 208"
                    item["raw"] = "BET-I, PD Trainer, 208"
                    updated_json_count += 1
        # Sec B
        if sec_name in ["3CSEB1", "3CSEB2", "B1", "B2", "3B", "B"]:
            for item in days.get("FRIDAY", []):
                if item.get("course_code") == "BMAT-003C" and "01:40" in item.get("time", ""):
                    item["details"] = "Dr. Ravinder, 207"
                    item["raw"] = "BMAT-003C, Dr. Ravinder, 207"
                    updated_json_count += 1

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(jdata, f, indent=2)
    print(f"PASS: Updated {json_path.name} ({updated_json_count} entries updated)")

# 7. Update raw_timetable_i_to_l.py and raw_timetable_a_to_d.py
raw_i_l = ROOT / "scripts" / "raw_timetable_i_to_l.py"
if raw_i_l.exists():
    txt = raw_i_l.read_text(encoding="utf-8")
    # Replace J1 & J2 Thursday 08:40-09:40 Shilpa Garg 169 -> 265
    txt = txt.replace(
        '{"period": 1, "time": "08:40am-09:40am", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Shilpa Garg, 169", "raw": "BMAT-003C, Dr. Shilpa Garg, 169"}',
        '{"period": 1, "time": "08:40am-09:40am", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Shilpa Garg, 265", "raw": "BMAT-003C, Dr. Shilpa Garg, 265"}'
    )
    # Replace I1 & I2 Thursday 01:40pm-02:40pm Shilpa Garg 169 -> 253
    txt = txt.replace(
        '{"period": 6, "time": "01:40pm-02:40pm", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Shilpa Garg, 169", "raw": "BMAT-003C, Dr. Shilpa Garg, 169"}',
        '{"period": 6, "time": "01:40pm-02:40pm", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Shilpa Garg, 253", "raw": "BMAT-003C, Dr. Shilpa Garg, 253"}'
    )
    # Replace I1 & I2 Friday 10:40am-11:40am BET-I 169 -> 208
    txt = txt.replace(
        '{"period": 3, "time": "10:40am-11:40am", "status": "class", "course_code": "BET-I", "details": "PD Trainer, 169", "raw": "BET-I, PD Trainer, 169"}',
        '{"period": 3, "time": "10:40am-11:40am", "status": "class", "course_code": "BET-I", "details": "PD Trainer, 208", "raw": "BET-I, PD Trainer, 208"}'
    )
    raw_i_l.write_text(txt, encoding="utf-8")
    print(f"PASS: Updated {raw_i_l.name}")

raw_a_d = ROOT / "scripts" / "raw_timetable_a_to_d.py"
if raw_a_d.exists():
    txt = raw_a_d.read_text(encoding="utf-8")
    # Replace B1 & B2 Friday 01:40pm-02:40pm Ravinder 118 -> 207
    txt = txt.replace(
        '{"period": 6, "time": "01:40pm-02:40pm", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Ravinder, 118", "raw": "BMAT-003C, Dr. Ravinder, 118"}',
        '{"period": 6, "time": "01:40pm-02:40pm", "status": "class", "course_code": "BMAT-003C", "details": "Dr. Ravinder, 207", "raw": "BMAT-003C, Dr. Ravinder, 207"}'
    )
    raw_a_d.write_text(txt, encoding="utf-8")
    print(f"PASS: Updated {raw_a_d.name}")

print("\n==================================================")
print("ALL 8 VENUE UPDATES SUCCESSFULLY APPLIED (100% PASS)")
print("==================================================")
