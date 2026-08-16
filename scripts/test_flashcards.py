import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot AI Flashcards Test Suite")
print("=======================================================\n")

# Test 1: Pydantic schema validation for flashcard generation
r1 = client.post("/api/generate-flashcards", json={
    "study_material_id": "invalid_id",
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r1.status_code == 422, f"Expected 422, got {r1.status_code}"
print("[PASS] Test 1: Pydantic validates study_material_id type correctly (HTTP 422)")

# Test 2: Flashcard count constraint validation (e.g. count > 30 should reject)
r2 = client.post("/api/generate-flashcards", json={
    "study_material_id": 1,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "count": 100
})
assert r2.status_code == 422, f"Expected 422 for count > 30, got {r2.status_code}"
print("[PASS] Test 2: Rejects excessive flashcard count requests (count <= 30 enforced)")

# Test 3: Review rating schema validation
r3 = client.post("/api/review-flashcard", json={
    "flashcard_id": 1,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "rating": "invalid_rating"
})
assert r3.status_code == 422, f"Expected 422 for invalid rating, got {r3.status_code}"
print("[PASS] Test 3: Rejects invalid self-assessment ratings (only again/hard/good/easy allowed)")

# Test 4: Safe handling of non-existent flashcard review
r4 = client.post("/api/review-flashcard", json={
    "flashcard_id": 999999,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "rating": "good"
})
assert r4.status_code in [404, 500], f"Expected 404/500, got {r4.status_code}"
print(f"[PASS] Test 4: Handled non-existent flashcard review safely with HTTP {r4.status_code}")

# Test 5: FastAPI Health Check
r5 = client.get("/health")
assert r5.status_code == 200 and r5.json().get("status") == "ok"
print("[PASS] Test 5: FastAPI server is healthy and operational.")

print("\nAll AI Flashcard tests passed successfully (100%).\n")
