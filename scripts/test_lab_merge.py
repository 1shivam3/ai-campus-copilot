import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "cse-3rd-sem-timetable(1).json"

with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

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
    if re.match(r"^\d+[A-Za-z]?$", last_tok) or last_tok in ["117", "118", "119", "142", "143", "144", "145", "147", "160", "161", "162", "167", "168", "169", "170", "174", "206", "207", "208", "236", "245", "252", "253", "254", "357"]:
        room = last_tok
        teacher = " ".join(tokens[:-1]).strip(", ")
        return teacher if teacher else None, room
    return s, None

# Section code map: 3CSEA1 -> A1, etc.
def normalize_sec(code):
    m = re.match(r"^3CSE([A-L][12])$", code)
    return m.group(1) if m else code

def normalize_course_code(code):
    if code == "BCSE-50lL":
        return "BCSE-501L"
    return code

timetable = data["timetable"]
merged_blocks = []
unmerged_count = 0
merged_sessions_count = 0

day_names = {
    "MONDAY": "Monday",
    "TUESDAY": "Tuesday",
    "WEDNESDAY": "Wednesday",
    "THURSDAY": "Thursday",
    "FRIDAY": "Friday"
}

for sec_code, days_map in timetable.items():
    section = normalize_sec(sec_code)
    for day_key, periods in days_map.items():
        day_name = day_names.get(day_key, day_key.capitalize())
        
        # Filter class periods
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
        unmerged_count += len(classes)
        
        # Merge consecutive 2-period labs
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
                    # Merge into one block
                    merged_blocks.append({
                        "section": section,
                        "day_of_week": day_name,
                        "course_code": curr["course_code"],
                        "start_time": curr["start_time"],
                        "end_time": nxt["end_time"],
                        "teacher_name": curr["teacher"],
                        "room": curr["room"],
                        "is_lab": True,
                        "merged_periods": [curr["period"], nxt["period"]]
                    })
                    merged_sessions_count += 1
                    i += 2
                    continue
            
            # Normal 1-period class (theory or unmerged lab)
            merged_blocks.append({
                "section": section,
                "day_of_week": day_name,
                "course_code": curr["course_code"],
                "start_time": curr["start_time"],
                "end_time": curr["end_time"],
                "teacher_name": curr["teacher"],
                "room": curr["room"],
                "is_lab": curr["is_lab"],
                "merged_periods": [curr["period"]]
            })
            i += 1

print(f"Total raw class periods: {unmerged_count}")
print(f"Merged 2-period lab sessions: {merged_sessions_count}")
print(f"Total timetable records after merging: {len(merged_blocks)}")
print(f"Average blocks per section: {len(merged_blocks) / 24}")
