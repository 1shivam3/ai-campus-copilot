import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = ROOT / "cse-3rd-sem-timetable(1).json"

# Load or generate complete timetable dictionary
# Let's populate with all sections
sections_meta = [
  {"code": "3CSEA1", "section": "A", "batch": 1},
  {"code": "3CSEA2", "section": "A", "batch": 2},
  {"code": "3CSEB1", "section": "B", "batch": 1},
  {"code": "3CSEB2", "section": "B", "batch": 2},
  {"code": "3CSEC1", "section": "C", "batch": 1},
  {"code": "3CSEC2", "section": "C", "batch": 2},
  {"code": "3CSED1", "section": "D", "batch": 1},
  {"code": "3CSED2", "section": "D", "batch": 2},
  {"code": "3CSEE1", "section": "E", "batch": 1},
  {"code": "3CSEE2", "section": "E", "batch": 2},
  {"code": "3CSEF1", "section": "F", "batch": 1},
  {"code": "3CSEF2", "section": "F", "batch": 2},
  {"code": "3CSEG1", "section": "G", "batch": 1},
  {"code": "3CSEG2", "section": "G", "batch": 2},
  {"code": "3CSEH1", "section": "H", "batch": 1},
  {"code": "3CSEH2", "section": "H", "batch": 2},
  {"code": "3CSEI1", "section": "I", "batch": 1},
  {"code": "3CSEI2", "section": "I", "batch": 2},
  {"code": "3CSEJ1", "section": "J", "batch": 1},
  {"code": "3CSEJ2", "section": "J", "batch": 2},
  {"code": "3CSEK1", "section": "K", "batch": 1},
  {"code": "3CSEK2", "section": "K", "batch": 2},
  {"code": "3CSEL1", "section": "L", "batch": 1},
  {"code": "3CSEL2", "section": "L", "batch": 2}
]

days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
periods = [
  {"period": 1, "time": "08:40am-09:40am"},
  {"period": 2, "time": "09:40am-10:40am"},
  {"period": 3, "time": "10:40am-11:40am"},
  {"period": 4, "time": "11:40am-12:40pm"},
  {"period": 5, "time": "12:40pm-01:40pm"},
  {"period": 6, "time": "01:40pm-02:40pm"},
  {"period": 7, "time": "02:40pm-03:40pm"}
]

print("Script template ready")
