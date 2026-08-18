"""
Automated Verification Suite for Search Bar & Focus / Study Material Removal
"""
import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from main import app
from services.database import get_database_client
from services.academic_search import search_academic_workspace

client = TestClient(app)

import asyncio

def test_academic_search():
    print("==================================================")
    print("TESTING ACADEMIC SEARCH SERVICE")
    print("==================================================")
    supabase_client = get_database_client()
    
    # 1. Search for a subject/curriculum topic
    res_topics = asyncio.run(search_academic_workspace(
        supabase_client=supabase_client,
        query="data structure",
        user_id="00000000-0000-0000-0000-000000000000",
        semester=3,
        section="B2",
        limit=10,
    ))
    assert len(res_topics) > 0, "Expected search results for 'data structure'"
    types = [r["type"] for r in res_topics]
    print(f"PASS: Query 'data structure' returned {len(res_topics)} results: {types}")
    assert any(t in ["syllabus", "timetable"] for t in types), "Expected syllabus or timetable types"

    # 2. Search for a class timetable query
    res_sched = asyncio.run(search_academic_workspace(
        supabase_client=supabase_client,
        query="Friday",
        user_id="00000000-0000-0000-0000-000000000000",
        semester=3,
        section="B2",
        limit=10,
    ))
    assert len(res_sched) > 0, "Expected timetable search results for 'Friday'"
    print(f"PASS: Query 'Friday' returned {len(res_sched)} timetable results: {[r['title'] for r in res_sched[:3]]}")
    
    # 3. Verify removed categories are NOT returned
    for r in res_topics + res_sched:
        assert r["type"] not in ["study_material", "flashcard", "previous_paper"], f"Unexpected removed type in search: {r['type']}"
    print("PASS: Verified that no removed study material/flashcard categories are returned")

def test_frontend_removal_integrity():
    print("\n==================================================")
    print("TESTING FRONTEND REMOVAL INTEGRITY")
    print("==================================================")
    
    deleted_paths = [
        "frontend/src/pages/FocusSession.jsx",
        "frontend/src/pages/StudyMaterial.jsx",
        "frontend/src/pages/StudyMaterialReader.jsx",
        "frontend/src/pages/StudyPack.jsx",
        "frontend/src/pages/Flashcards.jsx",
        "frontend/src/pages/ExamPaperAnalysis.jsx",
        "frontend/src/lib/pdfParser.js",
    ]
    
    for path in deleted_paths:
        full_path = os.path.join(os.path.dirname(__file__), "..", path)
        assert not os.path.exists(full_path), f"File {path} should have been deleted!"
    print(f"PASS: All {len(deleted_paths)} removed files are confirmed deleted from disk")
    
    # Check package.json for pdfjs-dist
    pkg_json_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "package.json")
    with open(pkg_json_path, "r", encoding="utf-8") as f:
        pkg_content = f.read()
    assert "pdfjs-dist" not in pkg_content, "pdfjs-dist must not be in package.json dependencies!"
    print("PASS: Confirmed pdfjs-dist is completely uninstalled from package.json")

if __name__ == "__main__":
    test_academic_search()
    test_frontend_removal_integrity()
    print("\n==================================================")
    print("ALL SEARCH & CLEANUP INTEGRITY CHECKS PASSED!")
    print("==================================================")
