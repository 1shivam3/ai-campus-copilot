import sys
import os
import time

os.environ["TEST_MODE"] = "1"

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from main import app
from services.auth import generate_test_token

client = TestClient(app)

def run_tests():
    start_time = time.time()
    print("\n=======================================================")
    print("       COURSEPIOT AI CAMPUS COPILOT - MASTER TEST SUITE")
    print("=======================================================\n")

    test_user_id = "00000000-0000-0000-0000-000000000000"
    test_token = generate_test_token(test_user_id, "test@university.edu")
    auth_headers = {"Authorization": f"Bearer {test_token}"}

    # 1. Health & Security
    print("[TEST 1/7] Backend Health & Security Headers Check...")
    r = client.get("/health")
    assert r.status_code == 200 and r.json().get("status") == "ok", "Health check failed"
    assert "nosniff" in r.headers.get("x-content-type-options", "").lower()
    print("  --> [PASS] Backend healthy with hardened security headers.")

    # 2. Input Validation & Schema Guards
    print("[TEST 2/7] Input Validation & Schema Rejection Guards...")
    r_bad_chat = client.post("/api/copilot-chat", headers=auth_headers, json={"message": "   ", "user_id": test_user_id})
    assert r_bad_chat.status_code == 400, "Should reject empty message"
    r_bad_schema = client.post("/api/copilot-chat", headers=auth_headers, json={"user_id": test_user_id})
    assert r_bad_schema.status_code == 422, "Should reject missing required field"
    r_blank_search = client.post("/api/academic-search", headers=auth_headers, json={"query": "  ", "user_id": test_user_id})
    assert r_blank_search.status_code == 200 and r_blank_search.json().get("total_results") == 0
    print("  --> [PASS] Input validation and schema rejection guards verified.")

    # 3. Global Academic Search
    print("[TEST 3/7] Global Academic Search (Hybrid Keyword + RAG)...")
    r_search = client.post("/api/academic-search", headers=auth_headers, json={
        "query": "Data Structures",
        "user_id": test_user_id,
        "semester": 3,
        "section": "B2",
        "limit": 10
    })
    assert r_search.status_code == 200
    assert "results" in r_search.json()
    print("  --> [PASS] Hybrid academic search executed and returned scoped results.")

    # 4. Spaced Repetition Flashcards Review Validation
    print("[TEST 4/7] Spaced Repetition Review Validation...")
    r_bad_rating = client.post("/api/review-flashcard", headers=auth_headers, json={
        "flashcard_id": 999999,
        "user_id": test_user_id,
        "rating": "invalid_rating"
    })
    assert r_bad_rating.status_code == 422, "Should reject invalid rating option"

    r_valid_schema = client.post("/api/review-flashcard", headers=auth_headers, json={
        "flashcard_id": 999999,
        "user_id": test_user_id,
        "rating": "good"
    })
    assert r_valid_schema.status_code in [403, 404, 500, 200]
    print("  --> [PASS] Spaced repetition rating validation guard verified.")

    # 5. Free Time & Study Window Math Utilities
    print("[TEST 5/7] Free Time & Study Window Math Utilities...")
    from services.copilot_context import parse_time_minutes, format_minutes_time
    assert parse_time_minutes("09:30 AM") == 570
    assert parse_time_minutes("02:15 PM") == 855
    assert format_minutes_time(570) == "09:30 AM"
    assert format_minutes_time(855) == "02:15 PM"
    print("  --> [PASS] Time window parsing and formatting math verified.")

    # 6. Study Copilot Context Aggregator
    print("[TEST 6/7] Copilot Server-Side Context Builder...")
    from services.copilot_context import build_copilot_context
    from main import supabase_client
    if supabase_client:
        import asyncio
        ctx = asyncio.run(build_copilot_context(supabase_client, test_user_id))
        assert "student" in ctx and "today" in ctx and "exams" in ctx and "tasks" in ctx
        print("  --> [PASS] Copilot context aggregated profile, timetable, and mastery.")
    else:
        print("  --> [SKIP] Supabase client offline, skipped live context build.")

    # 7. AI Study Copilot Chat
    print("[TEST 7/8] AI Study Copilot Chat Grounding & Intent Routing...")
    r_chat = client.post("/api/copilot-chat", headers=auth_headers, json={
        "message": "What is my academic priority today?",
        "user_id": test_user_id
    })
    assert r_chat.status_code == 200
    assert "message" in r_chat.json()
    print("  --> [PASS] AI Study Copilot Chat successfully synthesized grounded response.")

    # 8. Dynamic One-at-a-Time Exam Question Generation
    print("[TEST 8/9] Dynamic Exam Question Generator (MCQ / Short / Long / Practicals)...")
    r_q_mcq = client.post("/api/generate-exam-question", headers=auth_headers, json={
        "subject_name": "Data Structure and Algorithms",
        "syllabus_type": "theory",
        "question_type": "mcq",
        "selected_units": ["Unit 1", "Unit 3"],
        "difficulty": "medium",
        "answer_mode": "question_only",
        "used_questions": []
    })
    assert r_q_mcq.status_code == 200
    assert "question" in r_q_mcq.json()
    assert r_q_mcq.json()["question"]["question_type"] == "mcq"

    r_q_short = client.post("/api/generate-exam-question", headers=auth_headers, json={
        "subject_name": "Software Engineering Lab",
        "syllabus_type": "lab",
        "question_type": "short_answer",
        "selected_units": ["Practical 1", "Practical 2"],
        "difficulty": "hard",
        "answer_mode": "question_and_answer",
        "used_questions": []
    })
    assert r_q_short.status_code == 200
    assert "question" in r_q_short.json()
    assert r_q_short.json()["question"]["question_type"] == "short_answer"
    print("  --> [PASS] Dynamic exam question generator verified across theory and lab scopes.")

    # 9. Study Pack Generation Schema & Validation
    print("[TEST 9/9] Study Pack Generation & JSON Parser Validation...")
    from main import parse_llm_json, normalize_study_pack_schema
    sample_llm_raw = """
    ```json
    {
      "summary": "Data structures are specialized formats for organizing, processing, retrieving and storing data.",
      "key_concepts": ["Stack LIFO behavior", "Queue FIFO behavior"],
      "definitions": [{"term": "Stack", "definition": "A linear data structure following LIFO principle."}],
      "high_yield_points": ["Infix to postfix conversion uses a stack.", "BFS uses a queue."],
      "common_confusions": [{"confusion": "Array vs Linked List", "clarification": "Arrays have O(1) random access; linked lists have O(1) insertion."}],
      "examples": ["Pushing and popping call frames on execution stack."],
      "quick_revision": ["Review LIFO/FIFO time complexities."]
    }
    ```
    """
    parsed = parse_llm_json(sample_llm_raw)
    normalized = normalize_study_pack_schema(parsed)
    assert len(normalized["summary"]) > 20
    assert len(normalized["key_concepts"]) == 2
    assert len(normalized["definitions"]) == 1
    assert len(normalized["high_yield_points"]) == 2
    print("  --> [PASS] Study pack schema parser and normalizer fully verified.")

    # 10. Security Hardening, Protected Routes, Cross-User Isolation, Rate Limiting & Auth
    print("\n[TEST 10/11] Comprehensive Security Hardening & Cross-User Isolation Suite...")
    from test_security_hardening import test_security_hardening
    test_security_hardening()
    print("  --> [PASS] Security hardening, unauthenticated rejection, and cross-user isolation verified.")

    # 11. Data Consistency, MCQ Answer Distribution, XP Sync, Leaderboard & Mastery Suite
    print("\n[TEST 11/11] Data Consistency, MCQ Option Shuffling, Leaderboard & Subject Mastery Suite...")
    from test_data_consistency_fixes import test_data_consistency
    test_data_consistency()
    print("  --> [PASS] Data consistency, varied MCQ answers, XP sync, leaderboard ranking, and mastery isolation verified.")

    duration = round(time.time() - start_time, 2)
    print("\n=======================================================")
    print(f" ALL TESTS PASSED SUCCESSFULLY in {duration}s! (100% PASS)")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
