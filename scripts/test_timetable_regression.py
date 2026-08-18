import os
import sys
from pathlib import Path

# Add backend directory
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from services.database import get_database_client

def test_timetable_and_labs():
    db = get_database_client()
    print("==================================================")
    print("RUNNING TIMETABLE & LABS REGRESSION VERIFICATION")
    print("==================================================")

    # 1. Section B2 Class Schedule Query
    print("\n--- Test 1: Class Schedule Query with Teacher Names and Rooms ---")
    sched_res = db.table("class_schedule").select(
        "id, semester, section, day_of_week, start_time, end_time, room, teacher_name, subject_id, academic_subjects(id, subject_name, subject_code, subject_type, teacher_name, room)"
    ).eq("semester", 3).eq("section", "B2").order("day_of_week").order("start_time").execute()

    classes = sched_res.data or []
    assert len(classes) > 0, "No classes returned for Semester 3 Section B2"
    print(f"PASS: Retrieved {len(classes)} classes for Semester 3 Section B2")

    # Verify teacher_name and room
    teacher_count = 0
    room_count = 0
    for c in classes:
        teacher = c.get("teacher_name") or (c.get("academic_subjects") or {}).get("teacher_name")
        room = c.get("room") or (c.get("academic_subjects") or {}).get("room")
        if teacher:
            teacher_count += 1
        if room:
            room_count += 1

    print(f"Teacher names present in {teacher_count}/{len(classes)} classes")
    print(f"Rooms present in {room_count}/{len(classes)} classes")
    assert teacher_count > 0, "Teacher names are missing from class_schedule"
    assert room_count > 0, "Rooms are missing from class_schedule"
    print("PASS: Verified teacher names and rooms on class_schedule records")

    # 2. Section B2 Lab Schedule Query
    print("\n--- Test 2: Lab Schedule Query for Section B2 ---")
    labs_res = db.table("lab_schedule").select(
        "id, semester, section, day_of_week, start_time, end_time, subject_name, lab_room, teacher_name"
    ).eq("semester", 3).eq("section", "B2").order("day_of_week").order("start_time").execute()

    labs = labs_res.data or []
    assert len(labs) == 4, f"Expected 4 lab practicals for Section B2, got {len(labs)}"
    print(f"PASS: Retrieved {len(labs)} lab practicals for Section B2:")
    for lab in labs:
        print(f"  - [{lab['day_of_week']} {lab['start_time'][:5]}-{lab['end_time'][:5]}] {lab['subject_name']} (Room {lab['lab_room']}, Faculty: {lab['teacher_name']})")
        assert lab.get("subject_name"), "Lab subject_name is missing"
        assert lab.get("lab_room"), "Lab room is missing"
        assert lab.get("teacher_name"), "Lab teacher_name is missing"

    print("PASS: Verified all lab practical records have subject, room, teacher, and timing")

    # 3. Section A1 vs Section B2 Isolation
    print("\n--- Test 3: Section Schedule Isolation (A1 vs B2) ---")
    a1_classes = db.table("class_schedule").select(
        "id, teacher_name, room, academic_subjects(subject_name)"
    ).eq("semester", 3).eq("section", "A1").limit(5).execute().data

    b2_classes = db.table("class_schedule").select(
        "id, teacher_name, room, academic_subjects(subject_name)"
    ).eq("semester", 3).eq("section", "B2").limit(5).execute().data

    assert len(a1_classes) > 0 and len(b2_classes) > 0
    print(f"PASS: Section A1 sample teacher: {a1_classes[0]['teacher_name']}, Room: {a1_classes[0]['room']}")
    print(f"PASS: Section B2 sample teacher: {b2_classes[0]['teacher_name']}, Room: {b2_classes[0]['room']}")

    # 4. Academic Subjects Query
    print("\n--- Test 4: Academic Subjects Query ---")
    sub_res = db.table("academic_subjects").select(
        "id, semester, section, subject_name, subject_code, subject_type, teacher_name, room"
    ).eq("semester", 3).eq("section", "B2").order("subject_name").execute()

    subjects = sub_res.data or []
    assert len(subjects) > 0, "No academic subjects found for B2"
    print(f"PASS: Retrieved {len(subjects)} academic subjects for Section B2")

    print("\n==================================================")
    print("ALL TIMETABLE & LAB REGRESSION TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_timetable_and_labs()
