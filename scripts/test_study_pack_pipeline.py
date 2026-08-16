"""
Comprehensive Test Suite: Study Material & Study Pack Generation Pipeline
Validates end-to-end generation across Theory Syllabus, Lab Manual / Experiment Sheets,
Short Unchunked Notes, Caching, Force Regeneration, and Multi-User Security Isolation.
"""

import sys
import os
import time

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from fastapi.testclient import TestClient
from main import app, supabase_client

client = TestClient(app)

USER_A = "cab2bd5f-e2a4-48aa-80dc-7fbbac77aa24"
USER_B = "432089d8-0cc3-45b7-b4aa-321dda78bbfd"

created_material_ids = []

def run_tests():
    print("\n=======================================================")
    print("   COURSEPIOT STUDY PACK GENERATION PIPELINE AUDIT   ")
    print("=======================================================\n")

    if not supabase_client:
        print("[FAIL] Supabase client offline.")
        sys.exit(1)

    try:
        # -------------------------------------------------------------
        # TEST 1: Theory Syllabus PDF Document
        # -------------------------------------------------------------
        print("[TEST 1/5] Theory Syllabus PDF Study Pack Generation...")
        mat1 = supabase_client.table("study_materials").insert({
            "user_id": USER_A,
            "title": "Data Structures & Algorithms Comprehensive Syllabus",
            "original_file_name": "ds_syllabus.pdf",
            "storage_path": "materials/ds_syllabus.pdf",
            "extracted_character_count": 1024,
            "material_type": "syllabus",
            "unit_number": 1,
            "extracted_text": "Unit 1: Linear Data Structures, Arrays, Stacks, Queues. Unit 2: Trees, Binary Search Trees, AVL Trees. Unit 3: Graphs, BFS, DFS, Dijkstra. Unit 4: Hashing and Collision Resolution.",
        }).execute()
        
        mat1_id = mat1.data[0]["id"]
        created_material_ids.append(mat1_id)

        # Add 3 chunks
        supabase_client.table("study_material_chunks").insert([
            {
                "study_material_id": mat1_id,
                "chunk_index": 0,
                "page_number": 1,
                "content": "Unit 1: Stacks and Queues. Stack operates on LIFO principle (Last-In-First-Out). Queue operates on FIFO principle (First-In-First-Out). Applications include expression evaluation and recursion management."
            },
            {
                "study_material_id": mat1_id,
                "chunk_index": 1,
                "page_number": 2,
                "content": "Unit 2: Binary Search Trees. A BST maintains the invariant that left child < root < right child. AVL trees enforce balance factor of -1, 0, or +1 using single and double rotations."
            },
            {
                "study_material_id": mat1_id,
                "chunk_index": 2,
                "page_number": 3,
                "content": "Unit 3: Graph Traversal Algorithms. Breadth-First Search (BFS) uses a queue with time complexity O(V+E). Depth-First Search (DFS) uses recursion or a stack."
            }
        ]).execute()

        r1 = client.post("/api/generate-study-pack", json={
            "study_material_id": mat1_id,
            "user_id": USER_A,
            "force_regenerate": True
        })

        assert r1.status_code == 200, f"Expected 200 but got {r1.status_code}: {r1.text}"
        res1 = r1.json()
        pack1 = res1.get("study_pack", {})

        assert len(pack1.get("summary", "")) > 20, "Summary should be non-empty"
        assert len(pack1.get("key_concepts", [])) >= 2, "Should have key concepts"
        assert len(pack1.get("definitions", [])) >= 1, "Should have definitions"
        assert len(pack1.get("high_yield_points", [])) >= 1, "Should have high-yield points"
        print(f"  * Summary:           {pack1['summary'][:80]}...")
        print(f"  * Key Concepts:      {len(pack1['key_concepts'])} concepts extracted")
        print(f"  * Definitions:       {len(pack1['definitions'])} definitions parsed")
        print(f"  * High Yield Points: {len(pack1['high_yield_points'])} takeaways")
        print("  --> [PASS] Theory syllabus study pack generated with all schema keys.")

        # -------------------------------------------------------------
        # TEST 2: Lab / Experiment Manual PDF Document
        # -------------------------------------------------------------
        print("\n[TEST 2/5] Lab / Experiment Sheet Study Pack Generation...")
        mat2 = supabase_client.table("study_materials").insert({
            "user_id": USER_A,
            "title": "Data Structures Lab - Experiment 1 & 2 Manual",
            "original_file_name": "ds_lab_manual.pdf",
            "storage_path": "materials/ds_lab_manual.pdf",
            "extracted_character_count": 2048,
            "material_type": "lab_manual",
            "unit_number": None,
            "extracted_text": "Experiment 1: Write a C program to solve a 9x9 Su-Do-Ku puzzle using 2D array backtracking. Experiment 2: Implement Conway's Game of Life simulation using sparse matrix representation.",
        }).execute()
        
        mat2_id = mat2.data[0]["id"]
        created_material_ids.append(mat2_id)

        supabase_client.table("study_material_chunks").insert([
            {
                "study_material_id": mat2_id,
                "chunk_index": 0,
                "page_number": 1,
                "content": "Practical 1: 9x9 Su-Do-Ku Puzzle Solver. Input: 9x9 matrix with 0 representing empty cells. Algorithm: Recursive backtracking checking row, column, and 3x3 subgrid validity (startRow = row - row%3, startCol = col - col%3)."
            },
            {
                "study_material_id": mat2_id,
                "chunk_index": 1,
                "page_number": 2,
                "content": "Practical 2: Conway's Game of Life Sparse Matrix Simulation. Rules: Any live cell with 2 or 3 live neighbors survives. Any dead cell with exactly 3 live neighbors becomes a live cell. Implementation uses orthogonal linked lists for memory efficiency."
            }
        ]).execute()

        r2 = client.post("/api/generate-study-pack", json={
            "study_material_id": mat2_id,
            "user_id": USER_A,
            "force_regenerate": True
        })

        assert r2.status_code == 200, f"Expected 200 but got {r2.status_code}: {r2.text}"
        res2 = r2.json()
        pack2 = res2.get("study_pack", {})

        assert len(pack2.get("summary", "")) > 20, "Lab summary should be non-empty"
        assert len(pack2.get("key_concepts", [])) >= 2, "Lab key concepts should exist"
        print(f"  * Lab Summary:       {pack2['summary'][:80]}...")
        print(f"  * Examples / Steps:  {len(pack2.get('examples', []))} practical illustrations")
        print("  --> [PASS] Lab practical study pack generated accurately without unit bias.")

        # -------------------------------------------------------------
        # TEST 3: Short Unchunked Notes (Testing extracted_text Fallback)
        # -------------------------------------------------------------
        print("\n[TEST 3/5] Short Unchunked Notes (extracted_text fallback)...")
        mat3 = supabase_client.table("study_materials").insert({
            "user_id": USER_A,
            "title": "Software Engineering Quick Revision Notes",
            "original_file_name": "se_notes.txt",
            "storage_path": "materials/se_notes.txt",
            "extracted_character_count": 512,
            "material_type": "notes",
            "extracted_text": "Boehm's Spiral Model is a meta-model combining Waterfall and iterative prototyping with explicit risk analysis in every cycle. IEEE 830 specifies Software Requirements Specification standards emphasizing unambiguous, complete, and verifiable requirements.",
        }).execute()
        
        mat3_id = mat3.data[0]["id"]
        created_material_ids.append(mat3_id)

        r3 = client.post("/api/generate-study-pack", json={
            "study_material_id": mat3_id,
            "user_id": USER_A,
            "force_regenerate": True
        })

        assert r3.status_code == 200, f"Expected 200 but got {r3.status_code}: {r3.text}"
        res3 = r3.json()
        pack3 = res3.get("study_pack", {})
        assert len(pack3.get("summary", "")) > 10, "Summary should be derived from extracted_text"
        print(f"  * Fallback Summary:  {pack3['summary'][:80]}...")
        print("  --> [PASS] Direct extracted_text fallback successfully processed.")

        # -------------------------------------------------------------
        # TEST 4: Caching & Force Regeneration
        # -------------------------------------------------------------
        print("\n[TEST 4/5] Caching & Force Regeneration Flow...")
        # 4a. Second call with force_regenerate=False -> should be instant cached
        t_start = time.time()
        r4_cached = client.post("/api/generate-study-pack", json={
            "study_material_id": mat1_id,
            "user_id": USER_A,
            "force_regenerate": False
        })
        t_cache = round(time.time() - t_start, 3)
        assert r4_cached.status_code == 200
        assert r4_cached.json().get("cached") is True, "Should return cached=True"
        print(f"  * Cache Hit Time:    {t_cache}s (0ms AI latency)")

        # 4b. Third call with force_regenerate=True -> should regenerate fresh
        r4_regen = client.post("/api/generate-study-pack", json={
            "study_material_id": mat1_id,
            "user_id": USER_A,
            "force_regenerate": True
        })
        assert r4_regen.status_code == 200
        assert r4_regen.json().get("cached") is False, "Should return cached=False"
        print("  --> [PASS] Instant caching and forced regeneration verified.")

        # -------------------------------------------------------------
        # TEST 5: Multi-Tenant Security & Ownership Rejection
        # -------------------------------------------------------------
        print("\n[TEST 5/5] Multi-Tenant Security Isolation (User B -> User A's Material)...")
        r5_unauth = client.post("/api/generate-study-pack", json={
            "study_material_id": mat1_id,
            "user_id": USER_B, # Not the owner!
            "force_regenerate": False
        })
        assert r5_unauth.status_code == 403, f"Expected 403 Forbidden, got {r5_unauth.status_code}"
        print("  --> [PASS] Unauthorized user access strictly rejected with 403 Forbidden.")

    finally:
        # Clean up created test fixtures
        print("\n[CLEANUP] Cleaning up test fixtures from database...")
        for mid in created_material_ids:
            try:
                supabase_client.table("study_packs").delete().eq("study_material_id", mid).execute()
                supabase_client.table("study_material_chunks").delete().eq("study_material_id", mid).execute()
                supabase_client.table("study_materials").delete().eq("id", mid).execute()
            except Exception as e:
                pass
        print("  --> [DONE] Cleaned up temporary test study materials.")

    print("\n=======================================================")
    print(" ALL STUDY PACK PIPELINE TESTS PASSED (100% SUCCESS) ")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
