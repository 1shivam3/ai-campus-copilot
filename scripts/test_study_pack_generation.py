"""
Test & Diagnostic Suite for Study Pack Generation
Inspects study_materials, study_material_chunks, study_packs, and tests backend generation.
"""

import sys
import os
import json

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from fastapi.testclient import TestClient
from main import app, supabase_client

client = TestClient(app)

def run_diagnostics():
    print("\n=======================================================")
    print("      COURSEPIOT STUDY PACK GENERATION DIAGNOSTICS      ")
    print("=======================================================\n")

    if not supabase_client:
        print("[FAIL] Supabase client offline.")
        return

    # 1. Inspect existing study materials
    print("[1] Inspecting existing study_materials in Supabase...")
    materials_res = supabase_client.table("study_materials").select(
        "id, user_id, title, material_type, unit_number, extracted_text"
    ).limit(5).execute()

    materials = materials_res.data or []
    print(f"  --> Found {len(materials)} study_materials records.")
    for m in materials:
        text_len = len(m.get("extracted_text") or "")
        print(f"      * Material #{m['id']}: '{m.get('title')}' ({m.get('material_type')}), text_len={text_len}, user={m.get('user_id')[:8]}...")

    # 2. Check study_material_chunks for first material
    if materials:
        first_mat = materials[0]
        mat_id = first_mat["id"]
        user_id = first_mat["user_id"]

        print(f"\n[2] Checking chunks for material #{mat_id}...")
        chunks_res = supabase_client.table("study_material_chunks").select(
            "id, chunk_index, content"
        ).eq("study_material_id", mat_id).limit(5).execute()
        chunks = chunks_res.data or []
        print(f"  --> Found {len(chunks)} chunks for material #{mat_id}.")

        # 3. Test generate-study-pack endpoint
        print(f"\n[3] Calling POST /api/generate-study-pack for material #{mat_id} (force_regenerate=True)...")
        r = client.post("/api/generate-study-pack", json={
            "study_material_id": mat_id,
            "user_id": user_id,
            "force_regenerate": True
        })
        print(f"  --> Status Code: {r.status_code}")
        try:
            res_json = r.json()
            if r.status_code == 200:
                pack = res_json.get("study_pack", {})
                print("  --> [PASS] Study pack generated successfully!")
                print(f"      Summary preview: {pack.get('summary', '')[:100]}...")
                print(f"      Key concepts count: {len(pack.get('key_concepts', []))}")
                print(f"      Definitions count: {len(pack.get('definitions', []))}")
                print(f"      High-yield points: {len(pack.get('high_yield_points', []))}")
            else:
                print(f"  --> [FAIL] Error detail: {res_json.get('detail')}")
        except Exception as parse_err:
            print(f"  --> [FAIL] Response text: {r.text[:300]}")
    else:
        print("\n[!] No existing materials found in database to test directly. We will create mock material for testing.")

if __name__ == "__main__":
    run_diagnostics()
