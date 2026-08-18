"""
Test script to check Supabase study_packs table schema and test end-to-end generation.
"""

import sys
import os

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from main import supabase_client

def check_tables():
    print("\n--- CHECKING SUPABASE TABLES ---")
    if not supabase_client:
        print("[FAIL] supabase_client is None")
        return

    # Check study_materials
    try:
        res = supabase_client.table("study_materials").select("id, title, user_id").limit(1).execute()
        print("[PASS] study_materials table accessible. Data count:", len(res.data or []))
    except Exception as e:
        print("[FAIL] study_materials table error:", e)

    # Check study_material_chunks
    try:
        res = supabase_client.table("study_material_chunks").select("id, study_material_id").limit(1).execute()
        print("[PASS] study_material_chunks table accessible. Data count:", len(res.data or []))
    except Exception as e:
        print("[FAIL] study_material_chunks table error:", e)

    # Check study_packs
    try:
        res = supabase_client.table("study_packs").select("id, study_material_id, summary").limit(1).execute()
        print("[PASS] study_packs table accessible. Data count:", len(res.data or []))
    except Exception as e:
        print("[FAIL] study_packs table error:", e)

if __name__ == "__main__":
    check_tables()
