import json
import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / "backend" / ".env")

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def parse_time_range(time_str):
    # e.g., "08:40am-09:40am", "11:40am-12:40pm", "01:40pm-02:40pm"
    parts = time_str.lower().split("-")
    if len(parts) != 2:
        return time_str, time_str
    
    def to_24h(t):
        t = t.strip()
        m = re.match(r"(\d{1,2}):(\d{2})(am|pm)", t)
        if not m:
            return t
        h, mn, ap = int(m.group(1)), m.group(2), m.group(3)
        if ap == "pm" and h != 12:
            h += 12
        elif ap == "am" and h == 12:
            h = 0
        return f"{h:02d}:{mn}:00"
    
    return to_24h(parts[0]), to_24h(parts[1])

def parse_teacher_and_room(details_str):
    if not details_str:
        return None, None
    s = details_str.strip()
    # Check if last token is room number/code (e.g. 117, 142, 143, 206, 253, 168, 174, 357, 3A, (161))
    tokens = s.split()
    if not tokens:
        return None, None
    
    last_tok = tokens[-1].strip("(),[]")
    if re.match(r"^\d+[A-Za-z]?$", last_tok) or last_tok in ["117", "118", "119", "142", "143", "144", "145", "147", "160", "161", "162", "167", "168", "169", "170", "174", "206", "207", "208", "236", "245", "252", "253", "254", "357"]:
        room = last_tok
        teacher = " ".join(tokens[:-1]).strip(", ")
        return teacher if teacher else None, room
    return s, None
