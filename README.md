# AI Campus Copilot — CoursePilot

> A context-aware academic operating system and learning accelerator for university engineering students.

[![Production Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://ai-campus-copilot-one.vercel.app/)
[![Frontend](https://img.shields.io/badge/frontend-React_19_+_Vite-61dafb.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/backend-FastAPI_+_Python_3.12-009688.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/database-Supabase_+_PostgreSQL_+_pgvector-3ecf8e.svg)](https://supabase.com/)
[![AI Engine](https://img.shields.io/badge/AI-Google_Gemini-4285f4.svg)](https://ai.google.dev/)
[![Offline DB](https://img.shields.io/badge/offline-IndexedDB_+_Dexie-ff6f00.svg)](https://dexie.org/)

---

## Overview

**CoursePilot** (AI Campus Copilot) is an academic workspace designed for computer science and engineering undergraduates. It connects institutional curriculum structures (timetables, syllabus units, course topics) with individual student workflows (tasks, exams, topic mastery, study notes, and flashcards).

By integrating private document Retrieval-Augmented Generation (RAG), spaced-repetition flashcards, previous-year question paper analysis, and local-first IndexedDB caching, CoursePilot provides deterministic guidance and grounded AI study aids.

---

## Problem

Engineering students face fragmented academic information across disconnected platforms:
- **Scattered Reference Data**: Class timetables, course codes, and unit syllabi exist in separate PDFs, spreadsheets, or message groups.
- **Unstructured Study Materials**: Lecture slide decks, assignment sheets, and question banks pile up without direct alignment to syllabus topics.
- **Ungrounded AI Tools**: Generic AI chat tools hallucinate semester schedules, exam formats, and specific textbook content.
- **Network Dependency**: Many campus buildings and transit corridors have poor internet connectivity, leaving students unable to check their next class or review notes offline.

---

## Solution

CoursePilot structures the student workflow around their actual enrolled semester and section:
1. **Authoritative Academic Mapping**: Direct integration with Semester 3 CSE academic schedules across 24 sections (`A1` through `L2`).
2. **Private Document RAG**: Vector-indexed study materials enabling semantic Q&A strictly grounded in uploaded notes with page-level citations.
3. **Structured Learning Aids**: AI Study Packs, SM-2 spaced repetition flashcards, adaptive topic quizzes, and past exam paper analyzers.
4. **Offline-First Architecture**: Cache-first timetable and syllabus browsing powered by IndexedDB (Dexie) and PWA service workers with automatic cloud synchronization.

---

## Current Features

### 1. Authentication & Student Profile Setup
- **Supabase Authentication**: Secure email and password signup, login, session persistence, and logout.
- **Academic Profile**: Custom student display name, semester selection (Semester 3 CSE), section assignment (`A1`–`L2`), and custom avatar selection.
- **Cross-Device Profile & Stats Sync**: Authoritative backend synchronization for XP, daily streak, and reputation scores.

### 2. My Academics (Timetable & Courses)
- **Weekly Schedule View**: Full Monday through Friday schedule matrix (7 periods per day).
- **Section-Specific Allocation**: Accurate mapping across all 24 sections (`A1` through `L2`).
- **Theory & Lab Differentiation**: Distinguishes standard lectures from merged 2-hour laboratory practicals with normalized course codes (`BCSE-501L`, `BCSE-502L`).
- **Class Details**: Room numbers, faculty names, subject codes, and start/end time slots.
- **Today's Classes & Free Time**: In-browser calculation of today's schedule, current/next class indicators, and open study intervals ($\ge 30\text{ mins}$).

### 3. Syllabus Explorer
- **Curriculum Hierarchy**: Browse courses by subject code, title, and faculty.
- **Unit & Topic Breakdown**: Unit-level topic breakdown with descriptions and importance tags.
- **Syllabus Coverage**: 100% verified Semester 3 Computer Science & Engineering syllabus data.

### 4. Syllabus Progress & Mastery Tracking
- **Topic Mastery States**: Track topic progress across `Not Started`, `Learning`, and `Mastered`.
- **Mastery Score Calculation**: Numerical mastery percentage ($0\% - 100\%$) per topic and weighted unit averages.
- **Database Backed**: Fully backed by the `student_topic_progress` table with user-scoped isolation.
- **Offline Mutation**: Progress can be updated offline with a discrete `Pending sync` badge and automatic reconciliation upon reconnecting.

### 5. AI Topic Quizzes
- **Targeted Practice**: Generate adaptive 5-question multiple-choice quizzes for any syllabus topic.
- **Instant Evaluation**: Immediate scoring, detailed answer explanations, and automatic topic mastery updates.
- **Progress History**: Saves quiz scores to `topic_quiz_attempts` for longitudinal progress tracking.

### 6. Exam Management & Exam Mode
- **Exam Countdown**: Track upcoming midterms and finals with date countdowns and importance levels.
- **Exam Readiness Index**: Algorithmic readiness score ($0\% - 100\%$) based on syllabus topic mastery and quiz performance.
- **Risk Identification**: Highlights weak syllabus topics requiring immediate revision prior to exam dates.
- **Exam Practice Quizzes**: Multi-topic adaptive quizzes generated to simulate exam question distributions.

### 7. Task Management
- **Academic To-Do List**: Create and organize tasks with titles, course associations, deadlines, importance (`High`, `Medium`, `Low`), and estimated minutes.
- **Completion Tracking**: One-click completion status with automatic dashboard synchronization.

### 8. Study Material Hub & RAG Vector Search
- **PDF Upload & Storage**: Upload lecture notes, reference PDFs, and question papers to private Supabase Storage.
- **Text Extraction & Topic Matching**: Automatically extracts text and computes keyword/semantic relevance against syllabus topics.
- **Document Metadata**: Tag materials by course, unit number, and material type (`Lecture Notes`, `Lab Manual`, `Previous Year Paper`, `Reference`).
- **RAG Vector Search ("Ask This Material")**: Text is chunked (2,400 characters, 400 overlap) and embedded into 768-dimensional vectors stored with PostgreSQL `pgvector`. Semantic similarity search retrieves relevant passages for grounded question answering with page citations.

### 9. AI Study Packs
- **7-Part Structured Summary**: Automatically generates comprehensive study packs grounded in uploaded documents:
  1. Executive Summary
  2. Key Concepts
  3. Essential Definitions
  4. High-Yield Points
  5. Common Confusions & Pitfalls
  6. Real-World Engineering Examples
  7. Quick Revision Checklist
- **Database Caching**: Caches generated study packs in `study_packs` to prevent redundant Gemini API calls.

### 10. Spaced-Repetition AI Flashcards
- **Grounded Flashcard Generation**: Extracts high-yield question-and-answer pairs directly from study materials.
- **SM-2 Spaced Repetition**: Implements the SuperMemo-2 algorithm (`Again`, `Hard`, `Good`, `Easy`) to dynamically calculate interval days and ease factors.
- **Review Queue**: Tracks review history in `flashcard_reviews` and surfaces due cards on the student dashboard.

### 11. Previous-Year Question Paper Analyzer
- **Exam Intelligence**: Analyzes previous year question paper PDFs to extract:
  - Total question count and marks distribution
  - Syllabus topic frequency analysis
  - Repeated concepts and core themes
  - Question pattern taxonomy (Definition, Derivation, Numerical, Algorithm)
  - Topic-level revision priority scores

### 12. Focus Session (Study Timer)
- **Built-in Pomodoro Timer**: 25-minute focus intervals and custom study timers linked to specific tasks.
- **Session History**: Records completed study duration in `study_sessions` to contribute to daily study statistics.

### 13. Global Academic Search (`Ctrl + K`)
- **Instant Search Modal**: Search across syllabus topics, course notes, past papers, flashcards, tasks, and exams.
- **Hybrid Keyword & Topic Filter**: Fast client-side and database-backed pattern matching.

### 14. Smart Notifications
- **In-App Notification Center**: Alerts for imminent exam deadlines, overdue tasks, and pending flashcard reviews.
- **Anti-Spam Rate Limiting**: Notifications are deduplicated and capped at 1–2 alerts per day with individual card dismissal (`✕`).

### 15. Offline-First Architecture
- **PWA Service Worker**: Caches core application shell (HTML, CSS, JS, Google Fonts, SVG icons) for offline loading.
- **IndexedDB Local Database (Dexie)**: Structured local caching for `user_profile`, `class_schedule`, `academic_subjects`, `syllabus_topics`, `student_topic_progress`, and `sync_queue`.
- **Cache-First Loaders**: Timetable, Today's Classes, Free Time Windows, and Syllabus load in 0ms directly from local storage.
- **Offline Sync Queue**: Mutations made offline (such as updating topic progress) are queued with a `Pending sync` badge and auto-committed to Supabase on reconnect.
- **User Cache Isolation**: Private student records in IndexedDB are partitioned by `user_id` and wiped upon logout (`clearUserScopedCache`).
- **Online-Only Guards**: AI and server-dependent features display clean offline notices rather than failing silently.

---

## Application Flow

```text
Student Signs Up / Logs In
          │
          ▼
Selects Semester (3) & Section (e.g. B2)
          │
          ├───────────────────────────────────────────────┐
          ▼                                               ▼
   [Dashboard Home]                               [My Academics]
   • Today's Timetable                            • Full Weekly Timetable
   • Next Class Indicator                         • Theory & Lab Schedule
   • Free Time Windows                            • Room & Faculty Info
   • Daily 5-Question Challenge                   • Offline Cached View
   • Upcoming Exam Alerts                                 │
          │                                               │
          ▼                                               ▼
     [Syllabus]                                  [Study Materials]
   • Subject / Unit Breakdown                     • PDF Upload & Text Extraction
   • Topic Mastery Tracking                       • Auto Topic Matching
   • AI Topic Quizzes                             • RAG Document Q&A
          │                                       • AI Study Packs
          ▼                                       • SM-2 Spaced Flashcards
     [Exams & Tasks]                              • Previous-Year Paper Analyzer
   • Task Management & Deadlines                          │
   • Exam Readiness Scoring                               ▼
   • Focus Session Timer                          [Offline Sync Queue]
                                                  • Auto-syncs on reconnect
```

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          STUDENT WORKSPACE                             │
│       (Browser • Mobile PWA • Tablet • Desktop Responsive UI)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [Online Operations]                 [Offline Operations]
                  │                                   │
                  │ HTTPS Requests                    │ 0ms Local Read
                  │                                   ▼
                  │                         ┌───────────────────┐
                  │                         │ IndexedDB (Dexie) │
                  │                         │ • Timetable Cache │
                  │                         │ • Syllabus Cache  │
                  │                         │ • Topic Progress  │
                  │                         │ • Sync Queue      │
                  │                         └─────────┬─────────┘
                  │                                   │
                  │                                   │ Online Reconnect
                  │                                   ▼
                  ▼                         ┌───────────────────┐
┌──────────────────────────────────────┐    │ Automatic Sync    │
│           SUPABASE CLOUD             │◄───┤ Queue Processor   │
│  • PostgreSQL 15 Database            │    └───────────────────┘
│  • Row-Level Security (RLS)          │
│  • pgvector (768-dim embeddings)     │
│  • Private Storage (PDF Documents)   │
│  • Supabase Auth (JWT Verification)  │
└──────────────────┬───────────────────┘
                   │
                   │ Service Role
                   ▼
┌──────────────────────────────────────┐
│           FASTAPI BACKEND            │
│  • Google Gemini 2.5 / Flash SDK     │
│  • RAG Embedding & Chunking Pipeline │
│  • Study Pack & Flashcard Generation │
│  • Exam Paper Analyzer               │
│  • Cross-Device XP Reconciler        │
│  • Hardened Security Headers & CORS  │
└──────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 (Design System tokens, modern responsive grids)
- **Offline Storage**: Dexie (IndexedDB wrapper)
- **PDF Rendering & Parsing**: PDF.js (`pdfjs-dist`)
- **PWA**: Service Worker with navigation cache fallback (`sw.js`) and Web App Manifest

### Backend
- **Framework**: FastAPI (Python 3.12)
- **ASGI Server**: Uvicorn
- **AI SDK**: Google GenAI SDK (`google-genai` / `google-generativeai`)
- **PDF Extraction**: `pypdf`
- **Validation**: Pydantic v2

### Database & Storage
- **Database**: Supabase PostgreSQL 15
- **Vector Extension**: `pgvector` (768-dimensional embeddings via `text-embedding-004`)
- **Storage**: Supabase Private Storage Buckets
- **Security**: PostgreSQL Row-Level Security (RLS) policies on all student tables

---

## AI / RAG Architecture

```text
Student Uploads PDF (Lecture Notes / Question Paper)
                    │
                    ▼
          Text Extraction (pypdf)
                    │
                    ▼
     Semantic Chunking (2,400 chars, 400 overlap)
                    │
                    ▼
  768-dim Embeddings (Gemini text-embedding-004)
                    │
                    ▼
     PostgreSQL pgvector (study_material_chunks)
                    │
                    ▼
      User Asks Question in Document Reader
                    │
                    ▼
Vector Cosine Similarity Search (match_study_material_chunks RPC)
                    │
                    ▼
   Top Ranked Relevant Passages + Page Numbers
                    │
                    ▼
   Grounded Synthesis with Gemini 2.5 Flash
                    │
                    ▼
   Direct Answer with Page-Level Source Citations
```

---

## Database Architecture

### University Reference Tables (Public Read-Only)
| Table | Description | Key Columns |
| :--- | :--- | :--- |
| `academic_sections` | Valid semesters and section codes | `id`, `semester`, `section` |
| `academic_subjects` | Subjects per semester and section | `id`, `semester`, `section`, `subject_code`, `subject_name`, `subject_type`, `teacher_name` |
| `class_schedule` | Weekly lectures and labs (24 sections, 600 records) | `id`, `semester`, `section`, `day_of_week`, `start_time`, `end_time`, `room`, `teacher_name`, `subject_id` |
| `syllabus_topics` | Hierarchical syllabus breakdown by unit | `id`, `subject_id`, `unit_number`, `topic_name`, `description` |

### Student Workspace Tables (Row-Level Security Enabled)
| Table | Description | Ownership Rule |
| :--- | :--- | :--- |
| `student_profiles` | Student name, semester, and section | `auth.uid() = id` |
| `student_topic_progress` | Topic mastery status ($0\% - 100\%$) | `auth.uid() = user_id` |
| `tasks` | Assignments, lab reports, and deadlines | `auth.uid() = user_id` |
| `exams` | Midterm and final exam schedules | `auth.uid() = user_id` |
| `study_sessions` | Focus session durations and timestamps | `auth.uid() = user_id` |
| `topic_quiz_attempts` | Quiz scores and evaluation history | `auth.uid() = user_id` |
| `study_materials` | Uploaded document metadata and extracted text | `auth.uid() = user_id` |
| `study_material_topics` | Auto-matched syllabus topics | Joint ownership via `study_materials` |
| `study_material_chunks` | 768-dim vector embeddings for RAG | Joint ownership via `study_materials` |
| `study_packs` | Cached 7-part AI study summaries | `auth.uid() = user_id` |
| `study_flashcards` | Spaced-repetition flashcards with SM-2 metrics | `auth.uid() = user_id` |
| `flashcard_reviews` | Review ratings (`Again`, `Hard`, `Good`, `Easy`) | `auth.uid() = user_id` |
| `exam_paper_analysis` | Cached question paper analysis results | `auth.uid() = user_id` |

---

## Security

1. **Multi-Tenant Isolation**: All student data tables enforce PostgreSQL Row-Level Security (`auth.uid() = user_id`). Users cannot access, query, or mutate another student's tasks, notes, chunks, or progress.
2. **Private Storage**: Study material PDFs are stored in private Supabase Storage buckets. Temporary signed URLs expire automatically and are never made public.
3. **Backend Ownership Verification**: Every FastAPI mutation endpoint validates document ownership against `user_id` before performing RAG embedding, Q&A, or study pack generation.
4. **CORS & Security Headers**: Production CORS restricted to trusted frontend domains (`*.vercel.app`); backend injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
5. **No Secret Tracking**: All API keys, service role secrets, and database credentials are excluded from source control via `.gitignore`.
6. **Shared Device Safety**: Logging out purges all in-memory React state and IndexedDB private user stores (`clearUserScopedCache`), preventing data leakage on shared computers.

---

## Academic Data Import

The repository includes idempotent ingestion scripts to populate institutional academic data:
- **Timetable Source**: `cse-3rd-sem-timetable(1).json` (authoritative JSON representing Semester 3 CSE, Academic Year 2026–27).
- **Coverage**: 24 sections (`A1` through `L2`), 600 schedule rows, 25 periods per section, 0 Saturday/Sunday classes.
- **Normalization**: Automatically normalizes OCR/transcription typos (e.g. `BCSE-50lL` $\rightarrow$ `BCSE-501L`) and merges contiguous 2-hour laboratory blocks.
- **Execution Script**:
  ```bash
  python import_academic_data_complete.py
  ```

---

## Local Development

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### 1. Clone Repository
```bash
git clone https://github.com/1shivam3/ai-campus-copilot.git
cd ai-campus-copilot
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
# source venv/bin/activate

pip install -r ../requirements.txt
```

Create `backend/.env` (see Environment Variables).

Start backend development server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create `frontend/.env` (see Environment Variables).

Start frontend development server:
```bash
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)
```ini
GEMINI_API_KEY="your-gemini-api-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
FRONTEND_URL="http://localhost:5173"
```

### Frontend (`frontend/.env`)
```ini
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
VITE_BACKEND_URL="http://localhost:8000"
```

---

## Deployment

- **Frontend**: Deployed on [Vercel](https://ai-campus-copilot-one.vercel.app/) with automated production builds and SPA rewrite routing (`vercel.json`).
- **Backend**: Deployed on [Render](https://ai-campus-copilot-uanp.onrender.com/) with Uvicorn ASGI runtime.
- **Database & Storage**: Managed on [Supabase](https://supabase.com/).

---

## Testing

The project includes an automated multi-tier verification suite:

### 1. Backend Integration Test Suite
```bash
python scripts/run_all_tests.py
```
*Validates API health, security headers, input rejection guards, hybrid academic search, spaced repetition rating calculations, free time window math, and RAG retrieval.*

### 2. Multi-User Isolation Audit
```bash
python scripts/verify_multi_user_isolation.py
```
*Verifies database-level multi-tenant isolation between User A (Section B2) and User B (Section K2).*

### 3. Database Integrity Audit
```bash
python scripts/verify_database_integrity.py
```
*Verifies 0 duplicate timetable rows, 100% foreign key matching, zero weekend classes, and subject code normalization across all 24 sections.*

### 4. Offline Architecture & Sync Queue Audit
```bash
node scripts/verify_offline_architecture.js
```
*Verifies Dexie IndexedDB store initialization, offline timetable/syllabus caching, optimistic topic mastery mutation, sync queue processing, and logout cache purging.*

### 5. Frontend Production Build
```bash
cd frontend && npm run build
```

---

## Responsive Design

- **Mobile Viewports (< 768px)**: Fixed bottom navigation taskbar with safe-area insets (`Home`, `Academics`, `Tasks`, `Progress`, `More`), touch-friendly card stacks, and responsive modals.
- **Tablet Viewports (768px–1024px)**: Fluid 2-column grid cards, responsive timetable day selector, and touch targets $\ge 44\text{px}$.
- **Desktop & Large Displays ($\ge 1280px$)**: Persistent sidebar navigation, full-width weekly timetable matrix, side-by-side PDF reader, and multi-column analytics.

---

## Offline Support

CoursePilot features a comprehensive **offline-first** design for core academic reference and tracking:

### What Works Offline:
- **Timetable & Today's Schedule**: Full lecture and lab schedules load in 0ms from IndexedDB cache with last-synced timestamp badges.
- **Syllabus Navigation**: Browse subjects, units, topics, and descriptions without internet connectivity.
- **Today's Classes & Free Time**: In-browser calculation of today's schedule, current period, and free intervals.
- **Topic Mastery Updates**: Mark topics as `Not Started`, `Learning`, or `Mastered` offline; changes are saved locally with a `Pending sync` badge and auto-committed to Supabase when reconnected.

### Online-Only Features (with Friendly Offline Notices):
- Gemini AI Generation (Study Packs, Flashcards, AI Quizzes)
- RAG Document Q&A ("Ask This Material")
- Previous-Year Question Paper AI Analysis
- New PDF uploads and vector indexing

---

## Future Ideas / Planned Features

The following capabilities are conceptual designs or planned enhancements for future releases:
- **Attendance Tracker**: Automated attendance percentage calculation with minimum cutoff alerts.
- **Semester Planner**: Long-term credit tracking and prerequisite planning.
- **Advanced Daily Study Planner**: AI-scheduled calendar integration with dynamic daily study plans.
- **Academic Recovery Plans**: Automated catch-up schedules for missed classes or low test scores.
- **Full Conversational AI Copilot**: Multi-turn proactive voice and text study assistant.
- **Campus Resources & Notices Hub**: Real-time university administrative notice board and facility bookings.
