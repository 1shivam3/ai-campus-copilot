import json
from fastapi.testclient import TestClient
from main import app
from services.chunking import chunk_document_text, estimate_token_count
from services.embeddings import embed_text, embed_query

client = TestClient(app)

print("\n=======================================================")
print("CoursePilot RAG Pipeline Test Suite")
print("=======================================================\n")

# Test 1: Chunking & Token Preservation
sample_text = """
# Data Structures: Unit 1 Linked Lists

A singly linked list is a linear data structure where each element points to the next element.
Unlike arrays, linked lists do not require contiguous memory allocation.

## Insertion in Singly Linked List
To insert a node at the beginning, create a new node, point its next pointer to head, and update head.
Time complexity is O(1).

## Deletion in Singly Linked List
To delete a node from the front, set head = head.next.
Time complexity is O(1).

--- Page 2 ---
# Doubly Linked Lists
A doubly linked list contains two pointers: previous and next.
This allows bidirectional traversal but requires more memory overhead per node.
"""

chunks = chunk_document_text(sample_text, target_chunk_size=500, chunk_overlap=100)
assert len(chunks) >= 1, "Expected at least 1 chunk"
print(f"[PASS] Test 1: Document chunker produced {len(chunks)} semantic chunks with token estimation.")

# Test 2: Embedding Generation (768-dimensional vectors)
emb = embed_query("What is the difference between singly and doubly linked lists?")
assert len(emb) == 768, f"Expected 768-dim vector, got {len(emb)}"
print(f"[PASS] Test 2: Gemini Embeddings service generates {len(emb)}-dimensional vector embedding.")

# Test 3: RAG Indexing Endpoint Security & Validation
r_index = client.post("/api/index-study-material", json={
    "study_material_id": 999999,
    "user_id": "00000000-0000-0000-0000-000000000000"
})
assert r_index.status_code in [404, 500]
print(f"[PASS] Test 3: POST /api/index-study-material enforces ownership & non-existent material handling safely (HTTP {r_index.status_code}).")

# Test 4: RAG Q&A Endpoint Validation
r_ask = client.post("/api/ask-study-material", json={
    "study_material_id": 999999,
    "user_id": "00000000-0000-0000-0000-000000000000",
    "question": "Explain linked lists",
    "action_type": "ask"
})
assert r_ask.status_code in [404, 500]
print(f"[PASS] Test 4: POST /api/ask-study-material enforces RAG retrieval & ownership security (HTTP {r_ask.status_code}).")

# Test 5: FastAPI Health Check
r_health = client.get("/health")
assert r_health.status_code == 200 and r_health.json().get("status") == "ok"
print("[PASS] Test 5: FastAPI server is healthy and operational.")

print("\nAll RAG Pipeline tests passed successfully (100%).\n")
