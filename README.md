# CoursePilot — AI Campus Copilot

> The context-aware academic operating system and AI co-pilot for university engineering students.

[![Production Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://ai-campus-copilot-one.vercel.app/)
[![Frontend](https://img.shields.io/badge/frontend-React_19_+_Vite-61dafb.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/backend-FastAPI_+_Python_3.12-009688.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/database-Supabase_+_PostgreSQL_+_pgvector-3ecf8e.svg)](https://supabase.com/)
[![AI Engine](https://img.shields.io/badge/AI-Google_Gemini-4285f4.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 1. Problem & Solution

### The Challenge
University engineering students juggle dozens of competing demands—approaching midterms, lab deliverables, daily class schedules, unread syllabus chapters, and scattered lecture PDFs. Traditional to-do apps and generic AI chatbots lack academic grounding:
- Generic chatbots hallucinate course dates, exams, and timetables.
- To-do apps force manual prioritization and create decision fatigue.
- Study materials and syllabus progress are disconnected from daily schedules.

### The CoursePilot Solution
**CoursePilot** unifies a student's entire academic ecosystem into a single synchronized command center. By combining institutional course timetables and syllabus structures with private student data (tasks, exams, topic mastery, notes, and study sessions), CoursePilot provides deterministic guidance, grounded RAG assistance, and structured daily action plans.

---

## 2. Core Features

### 🎯 Next Best Action Engine
Evaluates assignment deadlines, academic importance, estimated effort, exam proximity, and syllabus mastery gaps to deterministically compute the single highest-yield study action right now, complete with transparent *"Why this now?"* reasoning.

### 📅 Dynamic Timetable & Free Study Windows
Section-specific weekly lecture and lab schedules (Monday–Friday). Automatically identifies available study windows ($\ge 30\text{ mins}$) between scheduled classes to time-block priority tasks.

### 🤖 Grounded AI Study Copilot Chat
A conversational assistant that queries the student's live server-side academic state (schedule, weak syllabus topics, upcoming exams, notes via RAG) to provide direct answers with structured interactive action buttons (`Start Focus Session`, `Open Exam Mode`, `Review Study Material`).

### 📚 Study Material Hub & RAG Vector Search
Upload lecture notes, lab manuals, and previous year papers to a private Supabase Storage bucket. PDFs are cleaned, chunked, and embedded into 768-dimensional vectors stored in PostgreSQL via `pgvector` for semantic document Q&A with page-level source citations.

### 📦 AI Study Packs
Generates a comprehensive 8-section study pack (Executive Summary, Key Concepts, Important Definitions, High-Yield Points, Common Confusions, Real-World Examples, Quick Revision Checklist, and Practice Questions) grounded strictly in uploaded documents.

### 🎴 Spaced-Repetition AI Flashcards
Turns uploaded course notes into interactive flashcards powered by the SM-2 spaced repetition algorithm (`Again`, `Hard`, `Good`, `Easy`) with automated review reminders on the Dashboard.

### 📊 Previous-Year-Paper Analyzer
Analyzes previous exam question papers to extract topic frequency distributions, unit weightage, repeated concepts, question patterns, and estimated revision priority scores.

### 🔍 Unified Global Academic Search (`Ctrl + K`)
Instant hybrid search combining SQL pattern matching with semantic vector retrieval across Syllabus, Study Notes, Past Papers, Flashcards, Tasks, and Exams.

### 📱 Responsive Mobile Bottom Taskbar
Fixed bottom tab bar for mobile viewports (`< 768px`) with safe-area insets and an expandable *More* bottom sheet, paired with a persistent desktop sidebar for larger screens.

---

## 3. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          STUDENT WORKSPACE                             │
│       (Web Browser • Mobile / Tablet / Desktop Responsive UI)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT 19 + VITE FRONTEND                        │
│   • Dashboard & Next Best Action      • Study Material Reader & RAG   │
│   • My Academics & Timetable          • AI Study Packs & Flashcards   │
│   • Syllabus & Topic Mastery          • Exam Paper Analyzer           │
│   • Global Academic Search (Ctrl+K)   • AI Study Copilot Chat         │
└──────────────────┬────────────────────────────────┬────────────────────┘
                   │                                │
      Client Auth  │                                │ API Requests
      & Direct RPC │                                │
                   ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│          SUPABASE BACKEND            │ │        FASTAPI BACKEND        │
│  • PostgreSQL 15 Database            │ │  • Gemini 2.5 / Flash SDK     │
│  • Row-Level Security (RLS)          │ │  • RAG Retrieval & Chunking   │
│  • pgvector (768-dim embeddings)     │ │  • Academic Context Engine    │
│  • Private Storage (PDF Documents)   │ │  • Paper Analyzer & Quizzes   │
│  • Supabase Auth (JWT Verification)  │ │  • Security Headers & CORS    │
└──────────────────────────────────────┘ └───────────────────────────────┘
```

---

## 4. RAG Document Pipeline Flow

```text
Student Uploads PDF
        │
        ▼
Extract Raw Text (pypdf)
        │
        ▼
Semantic Chunking (500-800 tokens, 100 token overlap)
        │
        ▼
Batch Vector Embeddings (Gemini embedding-001, 768 dimensions)
        │
        ▼
Store in PostgreSQL (`study_material_chunks` table with pgvector)
        │
        ▼
Student Question ──► Embed Query ──► Vector Similarity Search ──► Top 4 Chunks ──► Grounded Answer + Citations
```

---

## 5. Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Supabase Project with `pgvector` enabled
- Google Gemini API Key

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ai-campus-copilot.git
cd ai-campus-copilot
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy environment template and configure secrets
cp .env.example .env
```

Edit `backend/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Run backend server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Copy environment template
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:8000
```

Run frontend development server:
```bash
npm run dev
```

---

## 6. Running Test Suites

Run the master test suite to verify health, RAG vectors, context aggregation, and schema validations:
```bash
python scripts/run_all_tests.py
```

Run frontend production build verification:
```bash
cd frontend
npm run build
```

---

## 7. Production Deployment

| Component | Platform | Configuration |
| :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com/) | Build command: `npm run build`<br>Output directory: `dist`<br>Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` |
| **Backend** | [Render](https://render.com/) | Environment: `Python 3.12`<br>Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`<br>Set `GEMINI_API_KEY`, `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Database** | [Supabase](https://supabase.com/) | PostgreSQL 15 with `pgvector` extension enabled and Row-Level Security policies applied |

---

## 8. Known Limitations & Scope

1. **OCR on Scanned Handwritten Notes**: PDF extraction relies on standard text streams. Scanned images without embedded OCR text require pre-processing with an external OCR tool.
2. **Deterministic Schedule Bounds**: Class timetable matching is calibrated for the current active semester curriculum. Future semester schedules can be ingested via the `class_schedules` table without application code changes.
3. **Storage Quotas**: Supabase free-tier storage applies a 50MB file size limit per uploaded PDF document.

---

## 9. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
