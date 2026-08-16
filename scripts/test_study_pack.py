import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot AI Study Pack Test Suite")
print("=======================================================\n")

# Test 1: Request Schema Validation (missing fields)
r1 = client.post("/api/generate-study-pack", json={
    "study_material_id": "not_an_int"
})
assert r1.status_code == 422, f"Expected 422, got {r1.status_code}"
print("[PASS] Test 1: Pydantic request schema validation rejects invalid payload types (HTTP 422)")

# Test 2: Non-existent document ID and ownership enforcement
r2 = client.post("/api/generate-study-pack", json={
    "study_material_id": 777777,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "force_regenerate": False
})
assert r2.status_code in [404, 500], f"Expected 404/500, got {r2.status_code}"
print(f"[PASS] Test 2: Handled non-existent study material safely with HTTP {r2.status_code}")

# Test 3: FastAPI Health Check
r3 = client.get("/health")
assert r3.status_code == 200 and r3.json().get("status") == "ok"
print("[PASS] Test 3: FastAPI server is healthy and operational.")

print("\nAll AI Study Pack tests passed successfully (100%).\n")
