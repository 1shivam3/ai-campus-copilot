import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot AI Study Copilot Chat Test Suite")
print("=======================================================\n")

# Test 1: Reject empty messages with HTTP 400
r1 = client.post("/api/copilot-chat", json={
    "message": "   ",
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r1.status_code == 400, f"Expected 400, got {r1.status_code}"
print("[PASS] Test 1: Empty message rejected cleanly with HTTP 400.")

# Test 2: Pydantic schema validation
r2 = client.post("/api/copilot-chat", json={
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r2.status_code == 422, f"Expected 422 for missing message, got {r2.status_code}"
print("[PASS] Test 2: Pydantic validates required fields (message required).")

# Test 3: Copilot query processing with fallback / context synthesis
r3 = client.post("/api/copilot-chat", json={
    "message": "What should I study today?",
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r3.status_code == 200, f"Expected 200, got {r3.status_code}"
data3 = r3.json()
assert data3.get("status") == "success"
assert "message" in data3
print(f"[PASS] Test 3: Copilot chat executed successfully. Response snippet: {data3['message'][:60]}...")

# Test 4: Copilot notes query with RAG retrieval
r4 = client.post("/api/copilot-chat", json={
    "message": "Explain binary trees from my uploaded notes",
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r4.status_code == 200, f"Expected 200, got {r4.status_code}"
data4 = r4.json()
assert data4.get("status") == "success"
print(f"[PASS] Test 4: Copilot RAG notes query processed. Sources returned: {len(data4.get('sources', []))}")

# Test 5: Health Check
r5 = client.get("/health")
assert r5.status_code == 200 and r5.json().get("status") == "ok"
print("[PASS] Test 5: FastAPI server is healthy and operational.")

print("\nAll AI Study Copilot Chat tests passed successfully (100%).\n")
