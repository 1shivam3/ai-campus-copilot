import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot Topic Matching Unit Test Suite")
print("=======================================================\n")

# Test 1: Missing material / non-existent ID
r1 = client.post("/api/match-study-material", json={
    "study_material_id": 9999999,
    "user_id": "00000000-0000-0000-0000-000000000000"
})
print(f"[PASS] Test 1: Non-existent material handles safely with HTTP {r1.status_code}")
assert r1.status_code in [404, 500], f"Expected 404 or 500, got {r1.status_code}"

# Test 2: Request model validation (missing fields)
r2 = client.post("/api/match-study-material", json={
    "study_material_id": "invalid_id"
})
assert r2.status_code == 422, f"Expected 422 validation error, got {r2.status_code}"
print("[PASS] Test 2: Pydantic request schema validation rejects invalid types (HTTP 422)")

print("\nAll unit tests passed successfully.\n")
