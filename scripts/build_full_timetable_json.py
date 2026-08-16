import json
from pathlib import Path
from raw_timetable_a_to_d import TIMETABLE_A_TO_D
from raw_timetable_e_to_h import TIMETABLE_E_TO_H
from raw_timetable_i_to_l import TIMETABLE_I_TO_L

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = ROOT / "cse-3rd-sem-timetable(1).json"

meta = {
  "institution": "M. M. Engineering College, Mullana, Ambala, Department of Computer Science & Engineering (NBA Accredited Department)",
  "title": "Time Table for B.Tech (CSE) - 3rd Sem. Academic Year (2026 - 27)",
  "semester": "3rd Semester",
  "academic_year": "2026-27",
  "source_file": "3rd_CSE_-_Classwise_Time_Table_17_08_2026.xlsx",
  "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  "periods": [
    { "period": 1, "time": "08:40am-09:40am" },
    { "period": 2, "time": "09:40am-10:40am" },
    { "period": 3, "time": "10:40am-11:40am" },
    { "period": 4, "time": "11:40am-12:40pm" },
    { "period": 5, "time": "12:40pm-01:40pm" },
    { "period": 6, "time": "01:40pm-02:40pm" },
    { "period": 7, "time": "02:40pm-03:40pm" }
  ],
  "sections": [
    { "code": "3CSEA1", "section": "A", "batch": 1 },
    { "code": "3CSEA2", "section": "A", "batch": 2 },
    { "code": "3CSEB1", "section": "B", "batch": 1 },
    { "code": "3CSEB2", "section": "B", "batch": 2 },
    { "code": "3CSEC1", "section": "C", "batch": 1 },
    { "code": "3CSEC2", "section": "C", "batch": 2 },
    { "code": "3CSED1", "section": "D", "batch": 1 },
    { "code": "3CSED2", "section": "D", "batch": 2 },
    { "code": "3CSEE1", "section": "E", "batch": 1 },
    { "code": "3CSEE2", "section": "E", "batch": 2 },
    { "code": "3CSEF1", "section": "F", "batch": 1 },
    { "code": "3CSEF2", "section": "F", "batch": 2 },
    { "code": "3CSEG1", "section": "G", "batch": 1 },
    { "code": "3CSEG2", "section": "G", "batch": 2 },
    { "code": "3CSEH1", "section": "H", "batch": 1 },
    { "code": "3CSEH2", "section": "H", "batch": 2 },
    { "code": "3CSEI1", "section": "I", "batch": 1 },
    { "code": "3CSEI2", "section": "I", "batch": 2 },
    { "code": "3CSEJ1", "section": "J", "batch": 1 },
    { "code": "3CSEJ2", "section": "J", "batch": 2 },
    { "code": "3CSEK1", "section": "K", "batch": 1 },
    { "code": "3CSEK2", "section": "K", "batch": 2 },
    { "code": "3CSEL1", "section": "L", "batch": 1 },
    { "code": "3CSEL2", "section": "L", "batch": 2 }
  ]
}

combined_timetable = {}
combined_timetable.update(TIMETABLE_A_TO_D)
combined_timetable.update(TIMETABLE_E_TO_H)
combined_timetable.update(TIMETABLE_I_TO_L)

full_data = {
  "meta": meta,
  "timetable": combined_timetable
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(full_data, f, indent=2)

print(f"Successfully generated {OUTPUT_FILE} with {len(combined_timetable)} sections.")
