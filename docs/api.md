# CoursePilot API Reference

This document provides complete documentation of all implemented backend endpoints in the CoursePilot FastAPI server.

**Base Production URL**: `https://ai-campus-copilot-uanp.onrender.com`  
**Base Local URL**: `http://localhost:8000`

---

## 1. System & Health Endpoints

### `GET /`
- **Purpose**: Root health check endpoint confirming service status.
- **Authentication**: None
- **Response**:
  ```json
  {
    "status": "ok",
    "message": "AI Campus Copilot API is running",
    "version": "1.0.0"
  }
  ```

### `GET /health`
- **Purpose**: Uptime monitor and configuration verification endpoint.
- **Authentication**: None
- **Response**:
  ```json
  {
    "status": "healthy",
    "supabase": true,
    "gemini": true,
    "environment": "production"
  }
  ```

---

## 2. Study Material & RAG Endpoints

### `POST /api/analyze-material`
- **Purpose**: Extracts raw text from an uploaded study material PDF and identifies document structure.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "file_path": "user_materials/432089d8.../lecture_01.pdf"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "material_id": 12,
    "extracted_text_preview": "Unit 1: Introduction to Data Structures...",
    "char_count": 14250,
    "page_count": 8
  }
  ```

### `POST /api/match-study-material`
- **Purpose**: Computes keyword and semantic match scores between an uploaded PDF and syllabus topics to automatically suggest relevant course topics.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "subject_id": 4,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "matches": [
      {
        "syllabus_topic_id": 105,
        "topic_name": "Binary Search Trees",
        "confidence_score": 0.88
      }
    ]
  }
  ```

### `POST /api/index-study-material`
- **Purpose**: Chunks document text (2,400 characters, 400 overlap) and generates 768-dimensional vector embeddings stored in PostgreSQL `pgvector`.
- **Authentication**: User ID in request payload (verifies document ownership)
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "material_id": 12,
    "chunks_created": 14,
    "vector_dim": 768,
    "status": "ready"
  }
  ```

### `POST /api/ask-study-material`
- **Purpose**: Retrieval-Augmented Generation (RAG) question answering strictly grounded in the uploaded document. Performs vector cosine similarity search via `match_study_material_chunks` RPC.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "question": "What is the worst-case time complexity of quicksort?",
    "match_count": 5
  }
  ```
- **Response**:
  ```json
  {
    "answer": "According to page 4 of the lecture notes, the worst-case time complexity of quicksort is O(n^2), occurring when the chosen pivot is consistently the smallest or largest element.",
    "citations": [
      { "page_number": 4, "chunk_index": 3, "similarity": 0.89 }
    ]
  }
  ```

---

## 3. Learning Aids (Study Packs, Flashcards & Exam Papers)

### `POST /api/generate-study-pack`
- **Purpose**: Generates or retrieves cached 7-part comprehensive study pack grounded in the study material.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "study_pack": {
      "summary": "...",
      "key_concepts": [...],
      "definitions": [...],
      "high_yield_points": [...],
      "common_confusions": [...],
      "examples": [...],
      "quick_revision": [...]
    }
  }
  ```

### `POST /api/generate-flashcards`
- **Purpose**: Generates AI flashcards from document notes and initializes SM-2 spaced repetition metrics.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 12,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "count": 10
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "flashcards": [
      {
        "id": 101,
        "question": "What is an AVL Tree?",
        "answer": "A self-balancing binary search tree where the height difference between left and right subtrees is at most 1.",
        "difficulty": "Medium",
        "interval_days": 1,
        "ease_factor": 2.5
      }
    ]
  }
  ```

### `POST /api/review-flashcard`
- **Purpose**: Updates flashcard spaced repetition state based on user recall feedback.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "flashcard_id": 101,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "rating": "Good"
  }
  ```
- **Validation**: Rating must be one of `Again`, `Hard`, `Good`, `Easy`.
- **Response**:
  ```json
  {
    "success": true,
    "flashcard_id": 101,
    "new_interval_days": 3,
    "new_ease_factor": 2.6,
    "next_review_at": "2026-08-19T22:30:00Z"
  }
  ```

### `POST /api/analyze-exam-paper`
- **Purpose**: Analyzes previous year question paper PDFs to generate topic frequencies, marks distribution, repeated concepts, and revision priority scores.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "material_id": 15,
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "analysis": {
      "overview": "Semester 3 Midterm examination covering Units 1, 2, and 3.",
      "frequent_topics": [...],
      "unit_distribution": { "Unit 1": 30, "Unit 2": 45, "Unit 3": 25 },
      "repeated_concepts": [...],
      "question_patterns": [...],
      "difficulty_breakdown": { "Easy": 20, "Medium": 50, "Hard": 30 },
      "revision_recommendations": [...]
    }
  }
  ```

---

## 4. Quizzes & Exam Practice

### `POST /api/generate-quiz`
- **Purpose**: Generates a 5-question adaptive multiple-choice topic quiz.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "subject_name": "Data Structures",
    "topic_name": "Binary Search Trees",
    "unit_number": 2,
    "difficulty": "Medium"
  }
  ```
- **Response**:
  ```json
  {
    "questions": [
      {
        "id": 1,
        "question": "What is the time complexity of searching in a balanced BST?",
        "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        "correct_answer": 1,
        "explanation": "Searching in a balanced BST halves the search space at each step, yielding O(log n)."
      }
    ]
  }
  ```

### `POST /api/generate-exam-quiz`
- **Purpose**: Generates an adaptive multi-topic practice quiz covering the full exam syllabus.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "exam_subject": "Operating Systems",
    "topics": ["CPU Scheduling", "Deadlocks", "Memory Management", "Virtual Memory"],
    "question_count": 8
  }
  ```
- **Response**: Array of structured multiple-choice questions with answers and detailed explanations.

---

## 5. Global Search & Cross-Device Stats Sync

### `POST /api/academic-search`
- **Purpose**: Hybrid academic search across syllabus topics, course notes, past papers, flashcards, tasks, and exams.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "query": "Binary Trees",
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "semester": 3,
    "section": "B2"
  }
  ```
- **Response**:
  ```json
  {
    "query": "Binary Trees",
    "results": {
      "syllabus": [...],
      "study_materials": [...],
      "flashcards": [...],
      "tasks": [...],
      "exams": [...]
    }
  }
  ```

### `GET /api/user-stats/{user_id}`
- **Purpose**: Fetches unified cross-device progression stats (XP, streak, reputation, avatar, challenge history).
- **Authentication**: User ID URL parameter
- **Response**:
  ```json
  {
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "full_name": "Shivam Kumar",
    "display_name": "Shivam Kumar",
    "avatar_url": "https://api.dicebear.com/7.x/bottts/svg?seed=shivam",
    "total_xp": 140,
    "this_week_xp": 65,
    "streak": 3,
    "reputation": 95,
    "xp_transactions": [...],
    "challenge_history": [...]
  }
  ```

### `POST /api/sync-user-stats`
- **Purpose**: Reconciles and merges XP transactions and daily challenge completions from multiple devices using deterministic transaction keys.
- **Authentication**: User ID in request payload
- **Request Body**:
  ```json
  {
    "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
    "full_name": "Shivam Kumar",
    "total_xp": 140,
    "xp_transactions": [...],
    "challenge_history": [...]
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "stats": {
      "user_id": "432089d8-0cc3-45b7-b4aa-321dda78bbfd",
      "total_xp": 140,
      "this_week_xp": 65,
      "reputation": 95
    }
  }
  ```

### `GET /api/leaderboard`
- **Purpose**: Returns real student rankings based on verified cumulative and weekly XP.
- **Authentication**: None
- **Response**:
  ```json
  {
    "leaderboard": [
      {
        "rank": 1,
        "user_id": "432089d8...",
        "full_name": "Shivam Kumar",
        "total_xp": 140,
        "streak": 3,
        "avatar_url": "..."
      }
    ]
  }
  ```
