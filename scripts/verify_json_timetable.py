import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "cse-3rd-sem-timetable(1).json"

with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

timetable = data["timetable"]
sections = list(timetable.keys())
print(f"Sections: {len(sections)}")

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

print(f"Monday class periods: {day_class_counts.get('MONDAY', 0)}")
print(f"Tuesday class periods: {day_class_counts.get('TUESDAY', 0)}")
print(f"Wednesday class periods: {day_class_counts.get('WEDNESDAY', 0)}")
print(f"Thursday class periods: {day_class_counts.get('THURSDAY', 0)}")
print(f"Friday class periods: {day_class_counts.get('FRIDAY', 0)}")
print(f"Total class-period entries: {total_class_entries}")
print(f"Lab-period entries: {lab_period_entries}")
print(f"BCSE-50lL normalized: {bcse_50ll_count} -> BCSE-501L")
print(f"Saturday entries: {day_class_counts.get('SATURDAY', 0)}")

print("\nPer-section class period counts:")
for sec, cnt in sorted(section_class_counts.items()):
    print(f"  {sec}: {cnt} class periods")
