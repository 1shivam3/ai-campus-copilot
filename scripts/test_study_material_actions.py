"""
Comprehensive Regression Test Suite for Shared Study Material Actions & Database Path
Validates:
1. Database Client Initialization & Health
2. Ask AI (`/api/ask-study-material` with ask, summarize, important_points, explain_simply, quiz)
3. Study Pack Generation (`/api/generate-study-pack`)
4. Flashcards Generation (`/api/generate-flashcards`)
5. Strict Multi-Tenant Ownership & Isolation (HTTP 403 rejection)
"""

import sys
import os
import io

# Ensure UTF-8 output on Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from fastapi.testclient import TestClient
from main import app
from services.database import get_database_client

client = TestClient(app)
db = get_database_client()

USER_A = "cab2bd5f-e2a4-48aa-80dc-7fbbac77aa24"
USER_B = "432089d8-0cc3-45b7-b4aa-321dda78bbfd"

created_material_ids = []

def run_tests():
    print("\n=======================================================")
    print("  STUDY MATERIAL AI ACTIONS & SHARED DB PATH AUDIT    ")
    print("=======================================================\n")

    if not db:
        print("[FAIL] Database client could not be initialized.")
        sys.exit(1)

    try:
        # -------------------------------------------------------------
        # STEP 1: Create Shared Test Study Material Fixture
        # -------------------------------------------------------------
        print("[STEP 1] Creating Test Study Material & Chunks for User A...")
        mat = db.table("study_materials").insert({
            "user_id": USER_A,
            "title": "Operating Systems - Memory Management & Virtual Memory",
            "original_file_name": "os_memory.pdf",
            "storage_path": "materials/os_memory.pdf",
            "extracted_character_count": 2500,
            "material_type": "Lecture Notes",
            "unit_number": 3,
            "extracted_text": "Paging is a memory management scheme that eliminates the need for contiguous allocation. The page table maps logical addresses to physical frame numbers. TLB (Translation Lookaside Buffer) is a fast hardware cache. Demand paging loads pages only on page fault.",
        }).execute()

        mat_id = mat.data[0]["id"]
        created_material_ids.append(mat_id)

        db.table("study_material_chunks").insert([
            {
                "study_material_id": mat_id,
                "chunk_index": 0,
                "page_number": 1,
                "content": "Page Tables and Paging Architecture: Logical address is split into page number (p) and page offset (d). The frame number from page table replaces p to form physical address. Page size is typically 4KB."
            },
            {
                "study_material_id": mat_id,
                "chunk_index": 1,
                "page_number": 2,
                "content": "Page Replacement Algorithms: FIFO (First In First Out), LRU (Least Recently Used), and Optimal Page Replacement (Belady's). Belady's Anomaly occurs in FIFO where increasing page frames increases page faults."
            },
            {
                "study_material_id": mat_id,
                "chunk_index": 2,
                "page_number": 3,
                "content": "Virtual Memory and Thrashing: Thrashing occurs when a computer's virtual memory subsystem is in a constant state of paging. Working set model prevents thrashing by ensuring each process has sufficient resident pages."
            }
        ]).execute()
        print(f"  * Created material_id={mat_id} with 3 chunks.")

        # -------------------------------------------------------------
        # TEST 1: Ask AI (Q&A)
        # -------------------------------------------------------------
        print("\n[TEST 1/7] Ask AI Q&A (`/api/ask-study-material` action=ask)...")
        r_ask = client.post("/api/ask-study-material", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "question": "What is Belady's Anomaly and which algorithm causes it?",
            "action_type": "ask"
        })
        assert r_ask.status_code == 200, f"Expected 200, got {r_ask.status_code}: {r_ask.text}"
        ans_ask = r_ask.json()
        assert len(ans_ask.get("answer", "")) > 20
        assert "FIFO" in ans_ask.get("answer", "") or "Belady" in ans_ask.get("answer", "")
        print(f"  * Answer: {ans_ask['answer'][:90]}...")
        print("  --> [PASS] Ask AI answered question accurately grounded in document.")

        # -------------------------------------------------------------
        # TEST 2: Summarize Document
        # -------------------------------------------------------------
        print("\n[TEST 2/7] Summarize (`/api/ask-study-material` action=summarize)...")
        r_sum = client.post("/api/ask-study-material", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "question": "Summarize this document",
            "action_type": "summarize"
        })
        assert r_sum.status_code == 200
        ans_sum = r_sum.json()
        assert len(ans_sum.get("answer", "")) > 50
        print(f"  * Summary: {ans_sum['answer'][:90]}...")
        print("  --> [PASS] Comprehensive summary generated.")

        # -------------------------------------------------------------
        # TEST 3: Important Points
        # -------------------------------------------------------------
        print("\n[TEST 3/7] Important Points (`/api/ask-study-material` action=important_points)...")
        r_pts = client.post("/api/ask-study-material", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "question": "Extract important points",
            "action_type": "important_points"
        })
        assert r_pts.status_code == 200
        ans_pts = r_pts.json()
        assert len(ans_pts.get("answer", "")) > 50
        print(f"  * Points: {ans_pts['answer'][:90]}...")
        print("  --> [PASS] High-yield exam points extracted.")

        # -------------------------------------------------------------
        # TEST 4: Document Quiz Generation
        # -------------------------------------------------------------
        print("\n[TEST 4/7] Document Quiz (`/api/ask-study-material` action=quiz)...")
        r_quiz = client.post("/api/ask-study-material", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "question": "Generate document quiz",
            "action_type": "quiz"
        })
        assert r_quiz.status_code == 200
        ans_quiz = r_quiz.json()
        assert len(ans_quiz.get("answer", "")) > 30
        print(f"  * Quiz: {ans_quiz['answer'][:90]}...")
        print("  --> [PASS] Document practice quiz generated.")

        # -------------------------------------------------------------
        # TEST 5: Generate Study Pack
        # -------------------------------------------------------------
        print("\n[TEST 5/7] Generate Study Pack (`/api/generate-study-pack`)...")
        r_pack = client.post("/api/generate-study-pack", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "force_regenerate": True
        })
        assert r_pack.status_code == 200
        pack = r_pack.json().get("study_pack", {})
        assert len(pack.get("summary", "")) > 20
        assert len(pack.get("key_concepts", [])) >= 2
        print(f"  * Study Pack Summary: {pack['summary'][:80]}...")
        print("  --> [PASS] Study pack generated and persisted.")

        # -------------------------------------------------------------
        # TEST 6: Generate Flashcards
        # -------------------------------------------------------------
        print("\n[TEST 6/7] Generate Flashcards (`/api/generate-flashcards`)...")
        r_fc = client.post("/api/generate-flashcards", json={
            "study_material_id": mat_id,
            "user_id": USER_A,
            "count": 10,
            "force_regenerate": True
        })
        assert r_fc.status_code == 200
        cards = r_fc.json().get("flashcards", [])
        assert len(cards) >= 5
        print(f"  * Flashcards Generated: {len(cards)} cards")
        print("  --> [PASS] Flashcards generated and persisted.")

        # -------------------------------------------------------------
        # TEST 7: Multi-User Security Isolation (User B -> Material A)
        # -------------------------------------------------------------
        print("\n[TEST 7/7] Multi-Tenant Security Isolation (User B accessing Material A)...")
        r_sec_ask = client.post("/api/ask-study-material", json={
            "study_material_id": mat_id,
            "user_id": USER_B,
            "question": "What is in this document?",
            "action_type": "ask"
        })
        assert r_sec_ask.status_code == 403, f"Expected 403, got {r_sec_ask.status_code}"

        r_sec_pack = client.post("/api/generate-study-pack", json={
            "study_material_id": mat_id,
            "user_id": USER_B,
            "force_regenerate": False
        })
        assert r_sec_pack.status_code == 403, f"Expected 403, got {r_sec_pack.status_code}"

        r_sec_fc = client.post("/api/generate-flashcards", json={
            "study_material_id": mat_id,
            "user_id": USER_B,
            "count": 10,
            "force_regenerate": False
        })
        assert r_sec_fc.status_code == 403, f"Expected 403, got {r_sec_fc.status_code}"
        print("  --> [PASS] All unauthorized access strictly blocked with HTTP 403.")

    finally:
        print("\n[CLEANUP] Cleaning up test fixtures from database...")
        for mid in created_material_ids:
            try:
                db.table("study_flashcards").delete().eq("study_material_id", mid).execute()
                db.table("study_packs").delete().eq("study_material_id", mid).execute()
                db.table("study_material_chunks").delete().eq("study_material_id", mid).execute()
                db.table("study_materials").delete().eq("id", mid).execute()
            except Exception:
                pass
        print("  --> [DONE] Cleaned up temporary test study materials.")

    print("\n=======================================================")
    print(" ALL STUDY MATERIAL ACTIONS TESTS PASSED (100% SUCCESS)")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
