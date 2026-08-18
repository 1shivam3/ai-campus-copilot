import os
import sys
import time
from pathlib import Path
from fastapi.testclient import TestClient

# Set test mode so auth module accepts mock test tokens for deterministic testing
os.environ["TEST_MODE"] = "1"

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from main import app
from services.auth import generate_test_token, AuthenticatedUser
from services.calendar_auth import (
    generate_oauth_state,
    verify_oauth_state,
    save_calendar_tokens,
    get_calendar_tokens,
    delete_calendar_tokens,
)
from services.rate_limiter import check_rate_limit, clear_rate_limits

client = TestClient(app)

def test_public_health_endpoint():
    print("\n--- Test 1: Public /health endpoint ---")
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert res.json() == {"status": "ok"}
    print("PASS: /health is public and returns status: ok")

def test_unauthenticated_requests_return_401():
    print("\n--- Test 2: Unauthenticated requests return 401 Unauthorized ---")
    protected_routes = [
        ("GET", "/api/calendar/status"),
        ("GET", "/api/calendar/events"),
        ("POST", "/api/calendar/disconnect", {}),
        ("GET", "/api/calendar/auth-url"),
        ("POST", "/api/generate-exam-quiz", {"subject": "Computer Networks"}),
        ("POST", "/api/generate-exam-question", {"subject_name": "Operating Systems"}),
        ("POST", "/api/generate-quiz", {"topic_name": "Binary Trees"}),
        ("POST", "/api/study-advice", {"today": "Monday"}),
        ("POST", "/api/analyze-material", {"content": "Sample content", "subject": "DBMS"}),
        ("POST", "/api/match-study-material", {"study_material_id": 1}),
        ("POST", "/api/index-study-material", {"study_material_id": 1}),
        ("POST", "/api/ask-study-material", {"study_material_id": 1, "question": "What is this?"}),
        ("POST", "/api/generate-study-pack", {"study_material_id": 1}),
        ("POST", "/api/generate-flashcards", {"study_material_id": 1}),
        ("POST", "/api/review-flashcard", {"flashcard_id": 1, "rating": "good"}),
        ("POST", "/api/analyze-exam-paper", {"study_material_id": 1}),
        ("POST", "/api/academic-search", {"query": "database"}),
        ("POST", "/api/copilot-chat", {"message": "Help me study"}),
        ("POST", "/api/xp/award", {"amount": 25, "reason": "Test XP", "reference_id": "t1"}),
        ("POST", "/api/sync-user-stats", {"total_xp": 100}),
        ("GET", "/api/user-stats/user-1234"),
    ]

    for item in protected_routes:
        method = item[0]
        path = item[1]
        payload = item[2] if len(item) > 2 else None

        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json=payload or {})

        assert res.status_code == 401, f"Expected 401 for {method} {path}, got {res.status_code}: {res.text}"
        print(f"PASS: {method} {path} strictly requires authentication (401)")

def test_forged_or_invalid_tokens_return_401():
    print("\n--- Test 3: Forged or malformed Bearer tokens return 401 ---")
    headers = {"Authorization": "Bearer forged-invalid-token-xyz"}
    res = client.get("/api/calendar/status", headers=headers)
    assert res.status_code == 401
    print("PASS: Malformed/forged token rejected with 401")

def test_calendar_hmac_oauth_state():
    print("\n--- Test 4: HMAC signed OAuth state generation & validation ---")
    user_a = "user-alice-1111"
    user_b = "user-bob-2222"

    state_a = generate_oauth_state(user_a)
    assert state_a and len(state_a) > 20

    # Valid verification for user_a
    is_valid, extracted_user = verify_oauth_state(state_a, expected_user_id=user_a)
    assert is_valid is True
    assert extracted_user == user_a
    print("PASS: Valid state verified for user_a")

    # Rejection if user_b attempts to use user_a's state
    is_valid_b, _ = verify_oauth_state(state_a, expected_user_id=user_b)
    assert is_valid_b is False
    print("PASS: user_b cannot reuse user_a's OAuth state (Cross-user CSRF prevented)")

    # Tampered state rejection
    tampered_state = state_a[:-4] + "AAAA"
    is_valid_tampered, _ = verify_oauth_state(tampered_state, expected_user_id=user_a)
    assert is_valid_tampered is False
    print("PASS: Tampered OAuth state signature rejected")

    # Expired state
    is_valid_expired, _ = verify_oauth_state(state_a, expected_user_id=user_a, max_age_seconds=-1)
    assert is_valid_expired is False
    print("PASS: Expired OAuth state rejected")

def test_encrypted_calendar_token_store():
    print("\n--- Test 5: Encrypted calendar token storage & status check ---")
    user_id = "user-test-secure-calendar"
    token_payload = {
        "access_token": "ya29.sample-google-access-token-12345",
        "refresh_token": "1//sample-google-refresh-token-67890",
        "email": "student@university.edu",
        "expires_at": "2026-12-31T23:59:59Z",
        "last_synced": "2026-08-19T00:00:00Z",
    }

    # Save encrypted
    save_calendar_tokens(user_id, token_payload)

    # Verify decryption
    decrypted = get_calendar_tokens(user_id)
    assert decrypted is not None
    assert decrypted["access_token"] == token_payload["access_token"]
    assert decrypted["email"] == "student@university.edu"
    print("PASS: Token successfully encrypted, stored, and decrypted")

    # Verify status endpoint returns email/status without exposing raw tokens
    token_a = generate_test_token(user_id, "student@university.edu")
    headers = {"Authorization": f"Bearer {token_a}"}
    res = client.get("/api/calendar/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["connected"] is True
    assert data["email"] == "student@university.edu"
    assert "access_token" not in data
    assert "refresh_token" not in data
    print("PASS: /api/calendar/status strictly never exposes access or refresh tokens")

    # Disconnect
    res_disc = client.post("/api/calendar/disconnect", headers=headers, json={})
    assert res_disc.status_code == 200
    assert get_calendar_tokens(user_id) is None
    print("PASS: /api/calendar/disconnect safely deletes stored tokens")

def test_user_stats_isolation():
    print("\n--- Test 6: Cross-user profile access isolation ---")
    user_a = "user-alice-alpha"
    user_b = "user-bob-beta"

    token_a = generate_test_token(user_a, "alice@univ.edu")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Alice syncs her stats
    res_sync = client.post("/api/sync-user-stats", headers=headers_a, json={
        "full_name": "Alice Smith",
        "total_xp": 450,
    })
    assert res_sync.status_code == 200

    # Alice can read her own stats
    res_a = client.get(f"/api/user-stats/{user_a}", headers=headers_a)
    assert res_a.status_code == 200

    # Alice cannot read Bob's stats
    res_b = client.get(f"/api/user-stats/{user_b}", headers=headers_a)
    assert res_b.status_code == 403
    print("PASS: User A cannot read User B profile (403 Forbidden)")

def test_rate_limiting():
    print("\n--- Test 7: Rate limiter enforcement ---")
    user_id = "user-rate-limit-test"
    action = "test_ai_action"

    # Reset any existing counts
    # Burst up to limit of 3 requests
    for i in range(3):
        check_rate_limit(user_id, action, max_requests=3, window_seconds=10)

    # 4th request must raise RateLimitExceeded / 429
    try:
        check_rate_limit(user_id, action, max_requests=3, window_seconds=10)
        assert False, "Should have raised RateLimitExceeded"
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 429
        print("PASS: Excessive requests trigger 429 Too Many Requests")

if __name__ == "__main__":
    print("==================================================")
    print("RUNNING CRITICAL SECURITY REMEDIATION TEST SUITE")
    print("==================================================")
    test_public_health_endpoint()
    test_unauthenticated_requests_return_401()
    test_forged_or_invalid_tokens_return_401()
    test_calendar_hmac_oauth_state()
    test_encrypted_calendar_token_store()
    test_user_stats_isolation()
    test_rate_limiting()
    print("\n==================================================")
    print("ALL SECURITY TESTS PASSED PERFECTLY!")
    print("==================================================")
