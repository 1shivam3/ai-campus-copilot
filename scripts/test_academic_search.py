import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot Global Academic Search Test Suite")
print("=======================================================\n")

# Test 1: Short query handling (< 2 chars returns empty result list)
r1 = client.post("/api/academic-search", json={
    "query": "a",
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
data1 = r1.json()
assert data1.get("total_results") == 0, f"Expected 0 results for short query, got {data1.get('total_results')}"
print("[PASS] Test 1: Short query '< 2 characters' correctly bypassed and returned empty list.")

# Test 2: Pydantic validation
r2 = client.post("/api/academic-search", json={
    "query": "normalization",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "limit": 100 # Exceeds le=50
})
assert r2.status_code == 422, f"Expected 422 for limit > 50, got {r2.status_code}"
print("[PASS] Test 2: Pydantic validates search parameters (limit <= 50 enforced).")

# Test 3: Natural language query intent (e.g. 'my upcoming exams')
r3 = client.post("/api/academic-search", json={
    "query": "my upcoming exams",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "semester": 5
})
assert r3.status_code == 200, f"Expected 200, got {r3.status_code}"
data3 = r3.json()
assert data3.get("status") == "success"
print("[PASS] Test 3: Natural language query 'my upcoming exams' routed and processed cleanly.")

# Test 4: Subject keyword search (e.g. 'normalization')
r4 = client.post("/api/academic-search", json={
    "query": "normalization",
    "user_id": "00000000-0000-0000-0000-000000000000",
    "semester": 5
})
assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
data4 = r4.json()
assert data4.get("status") == "success"
print("[PASS] Test 4: Keyword search 'normalization' executed successfully.")

# Test 5: Health Check
r5 = client.get("/health")
assert r5.status_code == 200 and r5.json().get("status") == "ok"
print("[PASS] Test 5: FastAPI server is healthy and operational.")

print("\nAll Global Academic Search tests passed successfully (100%).\n")
