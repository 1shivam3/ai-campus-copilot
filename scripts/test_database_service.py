"""
Test Suite for Database Service and Background Client Initialization
Validates server-side client initialization, singleton access, thread safety,
and graceful error handling for foreground and background execution.
"""

import sys
import os
import threading
import concurrent.futures

backend_path = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.append(backend_path)

from services.database import get_database_client, init_database_client
from supabase import Client

def run_tests():
    print("\n=======================================================")
    print("      COURSEPIOT DATABASE SERVICE & CLIENT AUDIT       ")
    print("=======================================================\n")

    # 1. Test database client initialization
    print("[TEST 1/4] Server-Side Supabase Client Initialization...")
    client = get_database_client()
    assert client is not None, "Database client should not be None"
    assert isinstance(client, Client), f"Expected Client instance, got {type(client)}"
    print("  --> [PASS] Database client initialized successfully as singleton.")

    # 2. Test thread safety and concurrent access
    print("\n[TEST 2/4] Concurrent / Background Access Thread Safety...")
    def fetch_client():
        c = get_database_client()
        assert c is client, "All threads must receive identical singleton client"
        return True

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_client) for _ in range(16)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
        assert all(results)
    print("  --> [PASS] Verified thread-safe singleton access across 16 background threads.")

    # 3. Test material query with initialized client
    print("\n[TEST 3/4] Database Query Execution via Client...")
    res = client.table("academic_subjects").select("id, subject_name").limit(1).execute()
    assert res.data is not None
    print(f"  * Sample query executed: {len(res.data)} subject record returned.")
    print("  --> [PASS] Supabase client communicates with database backend.")

    # 4. Test missing configuration handling
    print("\n[TEST 4/4] Missing Configuration Guard...")
    saved_url = os.environ.get("SUPABASE_URL")
    saved_vite_url = os.environ.get("VITE_SUPABASE_URL")
    try:
        # Temporarily clear URL
        if "SUPABASE_URL" in os.environ: del os.environ["SUPABASE_URL"]
        if "VITE_SUPABASE_URL" in os.environ: del os.environ["VITE_SUPABASE_URL"]
        
        # Invalidate singleton to test init failure
        import services.database as db_mod
        db_mod._supabase_client = None

        try:
            db_mod.init_database_client()
            assert False, "Should have raised RuntimeError on missing environment"
        except RuntimeError as r_err:
            assert "missing required environment variables" in str(r_err).lower()
            print(f"  * Clean error on missing config: {r_err}")
            print("  --> [PASS] Missing configuration caught gracefully at startup/init.")
    finally:
        # Restore environment and client
        if saved_url: os.environ["SUPABASE_URL"] = saved_url
        if saved_vite_url: os.environ["VITE_SUPABASE_URL"] = saved_vite_url
        db_mod._supabase_client = None
        db_mod.get_database_client()

    print("\n=======================================================")
    print("   ALL DATABASE SERVICE TESTS PASSED (100% SUCCESS)    ")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
