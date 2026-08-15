# CoursePilot

> Your AI-powered academic co-pilot.

[![Production Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://ai-campus-copilot-one.vercel.app/)
[![Frontend](https://img.shields.io/badge/frontend-React_19_+_Vite-61dafb.svg)](https://react.dev/)
[![Backend](https://img.shields.io/badge/backend-FastAPI_+_Python_3.12-009688.svg)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/database-Supabase_+_PostgreSQL-3ecf8e.svg)](https://supabase.com/)
[![AI Engine](https://img.shields.io/badge/AI-Google_Gemini-4285f4.svg)](https://ai.google.dev/)

---

## 1. Overview

**CoursePilot** is an academic operating system and prioritization platform designed to eliminate decision fatigue for university students. During a typical semester, students juggle dozens of competing demands—approaching midterm exams, lab deliverables, daily lectures, and unread syllabus chapters—often leading to unstructured cramming or misallocated study time.

CoursePilot solves this challenge by unifying your complete academic landscape into a single, cohesive workflow. It integrates your lecture timetable, active assignments, exam milestones, syllabus unit trees, topic mastery curves, distraction-free study sessions, and course PDF documents into one synchronized command center.

The core differentiator of CoursePilot is its deterministic **Next Best Action Engine**. Instead of acting as a passive to-do list, CoursePilot continuously evaluates deadline urgency, academic importance, estimated effort, exam proximity, and syllabus mastery gaps to recommend the single most impactful study action you should take right now—accompanied by transparent "Why this now?" reasoning.

---

## 2. Key Features

### 🎯 Next Best Action
Synthesizes your entire academic workload, today's lecture schedule, and active exam dates to calculate a single, highest-yield study recommendation with an explicit priority score ($0–100$).

### 💡 Explainable Recommendations
Every recommended action includes clear, human-readable *"Why this now?"* rationale points detailing why that specific task or syllabus topic was prioritized over other items.

### 📊 Adaptive Topic Mastery
Topic mastery scores dynamically progress between $0\%$ and $100\%$ through self-assessments, focus sessions, and quiz simulations. Lower mastery scores automatically increase topic risk in upcoming exam calculations.

### 📝 Exam Mode & Risk Ranking
Ranks all syllabus topics by academic risk before an upcoming exam and generates 10-question adaptive multiple-choice simulations that weight questions toward your weakest areas.

### ⚡ AI Academic Copilot
A schedule-aware study intelligence advisor that formulates time-blocked action plans designed to fit cleanly inside your free study windows between scheduled lectures.

### 📄 Study Material Analysis
Upload course PDFs or lecture notes to extract text and generate concise concept summaries, 8-point quick revision cards, and customized practice MCQs.

### ⏱️ Deep Work Focus Sessions
Integrated Pomodoro timers ($25$, $45$, or $60$ minutes) linked to active academic tasks. Completing a focus session updates your subject mastery and immediately refreshes your next recommendation.

### 🏛️ Academic Management
Pre-configured semester curricula mapping enrolled theory subjects, lab practicals, room numbers, faculty details, and unit-by-unit syllabus breakdowns.

### 🛡️ Authentication & Security
Robust user authentication powered by Supabase Auth with database-level Row Level Security (RLS) enforcing complete multi-tenant student data isolation.

---

## 3. Product Workflow

```text
[ Student Academic Data ]
(Timetable • Tasks • Exams • Syllabus • Mastery)
           │
           ▼
[ Supabase PostgreSQL ]
           │
           ▼
[ Priority & Mastery Engine ]
(Deterministic multi-factor algorithm)
           │
           ▼
[ Next Best Action + Rationale ]
           │
           ▼
[ Student Executes Focus Session ]
           │
           ▼
[ Updated Topic Mastery (0-100%) ]
           │
           ▼
[ Real-Time Priority Recalculation ]
```

### The Feedback Loop
When a student completes a focus session or quiz, their topic mastery score is mathematically updated in PostgreSQL ($\text{Mastery}_{\text{new}} = \text{Mastery}_{\text{prev}} \times 0.70 + \text{Score}_{\text{quiz}} \times 0.30$). The engine instantly recalculates priority weights, removes completed tasks, and generates the next optimal action without requiring a page reload.

---

## 4. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ REACT FRONTEND (Vite SPA)                                   │
│ • Client-side UI & Routing                                  │
│ • Deterministic Next Best Action Engine (useMemo)           │
│ • In-browser PDF text parsing (pdfjs-dist worker)           │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Direct CRUD + Token Auth      │ HTTPS API
               ▼                               ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│ SUPABASE (PostgreSQL)        │ │ FASTAPI BACKEND PROXY      │
│ • Supabase Auth (JWT)        │ │ • Input validation         │
│ • Row Level Security (RLS)   │ │ • Security middleware      │
│ • Private Storage Buckets    │ │ • Model fallback cascade   │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │ HTTPS
                                               ▼
                                 ┌────────────────────────────┐
                                 │ GOOGLE GEMINI API          │
                                 │ • Adaptive Exam Quizzes    │
                                 │ • Schedule Study Advice    │
                                 │ • PDF Material Analysis    │
                                 └────────────────────────────┘
```

---

## 5. Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 | Declarative UI, state management, and component hierarchy |
| **Build Tooling** | Vite 8 | Fast HMR, production minification, and Rollup chunking |
| **Styling** | Tailwind CSS 4 | Utility-first responsive design tokens and typography |
| **Document Parser** | PDF.js (`pdfjs-dist`) | Client-side text extraction from uploaded study PDFs |
| **Backend Framework** | FastAPI | High-performance Python async REST API proxy |
| **Language** | Python 3.12 | Backend business logic and Gemini SDK integration |
| **Database** | PostgreSQL (Supabase) | Relational schema with foreign keys, constraints, and indexes |
| **Authentication** | Supabase Auth | Encrypted user management, session JWTs, and password hashing |
| **Cloud Storage** | Supabase Storage | User-isolated cloud storage for study documents |
| **LLM Provider** | Google Gemini | Generative AI models (`gemini-flash-latest`, `gemini-3.5-flash`) |
| **Frontend Hosting** | Vercel | Global edge CDN, SPA routing rewrites, and Git CI/CD |
| **Backend Hosting** | Render | Managed cloud web service running Uvicorn |

---

## 6. Project Structure

```text
coursepilot/
├── backend/
│   ├── main.py                     # FastAPI application, security middleware & AI endpoints
│   ├── requirements.txt            # Python dependencies (FastAPI, uvicorn, google-genai)
│   ├── .env.example                # Backend environment variable template
│   └── .gitignore                  # Virtual environment and cache ignores
│
├── frontend/
│   ├── public/
│   │   ├── favicon.svg             # Scalable browser favicon
│   │   └── icon.svg                # High-res PWA/shortcut app icon
│   ├── src/
│   │   ├── components/
│   │   │   ├── CoursePilotLogo.jsx # Reusable logo and wordmark components
│   │   │   ├── EmptyState.jsx      # Reusable empty data state component
│   │   │   ├── ErrorState.jsx      # Reusable error state with retry actions
│   │   │   ├── Sidebar.jsx         # Responsive sidebar & mobile drawer navigation
│   │   │   └── SkeletonLoader.jsx  # Layout-shift-free skeleton placeholders
│   │   ├── pages/
│   │   │   ├── AITest.jsx          # Schedule-aware AI study advisor
│   │   │   ├── Auth.jsx            # Sign in and account creation interface
│   │   │   ├── ExamMode.jsx        # Exam readiness ranking and quiz launcher
│   │   │   ├── ExamQuiz.jsx        # Adaptive 10-question exam simulation interface
│   │   │   ├── Exams.jsx           # Exam schedule tracker & countdowns
│   │   │   ├── FocusSession.jsx    # Pomodoro timer and deep-work tracker
│   │   │   ├── LandingPage.jsx     # Public-facing product landing page
│   │   │   ├── MyAcademics.jsx     # Semester schedule & faculty contact directory
│   │   │   ├── ProfileSetup.jsx    # Student semester & section onboarding
│   │   │   ├── Progress.jsx        # Syllabus mastery matrix & self-evaluations
│   │   │   ├── StudyMaterial.jsx   # PDF upload, extraction & AI study packs
│   │   │   ├── Syllabus.jsx        # Curriculum unit trees and descriptions
│   │   │   ├── Tasks.jsx           # Assignment CRUD with priority sorting
│   │   │   └── TopicQuiz.jsx       # Individual topic test interface
│   │   ├── utils/
│   │   │   ├── dailyPlan.js        # Chronological day timeline generator
│   │   │   ├── examPriority.js     # Topic risk ranking algorithms
│   │   │   ├── examReadiness.js    # Deterministic exam readiness score calculator
│   │   │   ├── freeTime.js         # Timetable gap & study window detector
│   │   │   ├── mastery.js          # Focus session mastery increment logic
│   │   │   ├── masteryModel.js     # Quiz score weighted mastery calculation
│   │   │   ├── nextBestActionEngine.js # 5-stage deterministic recommendation engine
│   │   │   ├── priority.js         # Task deadline & effort priority calculator
│   │   │   └── syllabusProgress.js # Overall syllabus completion aggregator
│   │   ├── lib/
│   │   │   ├── academicData.js     # Timetable and course query helpers
│   │   │   ├── api.js              # Backend API fetch client with timeout handling
│   │   │   ├── pdfParser.js        # PDF text extractor worker
│   │   │   ├── supabase.js         # Supabase client initialization
│   │   │   └── todaySchedule.js    # Day-of-week schedule filters
│   │   ├── App.jsx                 # Application container & authenticated routing
│   │   ├── index.css               # Design tokens, scrollbars & reset styles
│   │   └── main.jsx                # React root entry point
│   ├── index.html                  # HTML5 entry with metadata & font preconnects
│   ├── package.json                # Frontend package dependencies & scripts
│   ├── vercel.json                 # SPA rewrites & production security headers
│   └── vite.config.js              # Rollup chunk splitting & vendor separation
│
├── docs/
│   ├── architecture.md             # Technical architecture & data flow diagrams
│   ├── demo-script.md              # 30-sec, 2-min, and 5-min demonstration guides
│   └── security.md                 # RLS policies, threat model & key isolation
│
├── .gitignore                      # Top-level Git ignores
└── README.md                       # Main repository technical documentation
```

---

## 7. Next Best Action Engine

The Next Best Action Engine operates deterministically to rank academic tasks and syllabus topics.

### Scoring Model
$$\text{Priority Score} = 0.30(\text{Urgency}) + 0.25(\text{Impact}) + 0.20(\text{Risk}) + 0.15(\text{Time Relevance}) + 0.10(\text{Importance}) - \text{Effort Penalty}$$

### Core Invariants:
1. **Completion Exclusion**: Completed or deleted tasks are immediately removed from candidate pools.
2. **Lecture Precedence**: If a scheduled lecture starts in $\le 15$ minutes, `ATTEND_CLASS` overrides other actions.
3. **Exam Urgency Boost**: If an exam is $\le 3$ days away and topic mastery is $< 60\%$, `PREPARE_FOR_EXAM` is assigned `CRITICAL` priority.
4. **Mathematical Clamping**: All composite priority scores and topic masteries are strictly bounded in $[0, 100]$.

---

## 8. Security & Privacy

- **Row Level Security (RLS)**: Enforced on all student tables (`student_profiles`, `tasks`, `exams`, `topics`, `study_sessions`). PostgreSQL verifies `auth.uid() = user_id` on every query.
- **Server-Side API Key Isolation**: `GEMINI_API_KEY` is stored solely on the backend server environment and is never bundled into client JavaScript.
- **File Upload Protection**: PDF uploads are validated for MIME type, restricted to user-specific storage paths (`study-material/${user.id}/*`), and constrained to a maximum size of **10MB**.
- **Defensive Headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin` are injected on all responses.

For detailed security documentation, see [docs/security.md](docs/security.md).

---

## 9. AI Architecture

```text
Browser Client ──► FastAPI Proxy ──► Google Gemini API
      ▲                  │                  │
      │                  ▼                  ▼
      └───────── Sanitized Output ◄── Raw Response
```

### Why a Backend Proxy?
Directly calling LLM APIs from client browsers exposes private API keys to extraction via browser DevTools and prevents request rate limiting or server-side payload validation. CoursePilot routes all AI requests through FastAPI to sanitize input, enforce character limits, and catch upstream model errors safely.

---

## 10. Local Development Setup

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: v3.11 or v3.12
- **Git**

### 1. Clone Repository
```bash
git clone https://github.com/1shivam3/ai-campus-copilot.git
cd ai-campus-copilot
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The client will be running at `http://localhost:5173`.

### 3. Backend Setup
Open a second terminal:
```bash
cd backend
python -m venv venv
```

**Activate Virtual Environment**:
- **Windows (PowerShell)**: `venv\Scripts\Activate.ps1`
- **Linux / macOS**: `source venv/bin/activate`

**Install Dependencies & Run**:
```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
The API server will be running at `http://localhost:8000`.

---

## 11. Environment Variables

### Frontend (`frontend/.env`)
```ini
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:8000
```

### Backend (`backend/.env`)
```ini
GEMINI_API_KEY=your_google_gemini_api_key
VITE_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> [!CAUTION]
> Never commit `.env` files containing live credentials. Store production environment variables directly in your Vercel and Render project settings.

---

## 12. Deployment

- **Frontend**: Hosted on [Vercel](https://vercel.com/) with automatic builds triggered from the `main` branch.
- **Backend API**: Hosted on [Render](https://render.com/) as a managed Web Service.
- **Database & Auth**: Managed PostgreSQL and Auth infrastructure on [Supabase](https://supabase.com/).
- **AI Services**: Google Cloud Gemini Developer API.

---

## 13. Live Application

- **Production App**: [https://ai-campus-copilot-one.vercel.app/](https://ai-campus-copilot-one.vercel.app/)
- **Backend Health Check**: `https://ai-campus-copilot-uanp.onrender.com/health`

---

## 14. Testing & Verification

| Testing Category | Methodology | Verification Result |
| :--- | :--- | :--- |
| **Vite Production Build** | Automated CLI | Compiled in **417ms** with 0 errors and 0 warnings. |
| **Next Best Action Engine** | Automated Node.js Script | Verified all 5 priority scenarios (A, B, C, D, E). |
| **Backend Health & Routes** | Automated Python test | Verified `/health`, `/api/generate-exam-quiz`, `/api/study-advice`. |
| **Authentication & RLS** | Manual QA | Verified multi-tenant user data isolation in Supabase. |
| **Task & Exam CRUD** | Manual QA | Verified creation, status toggles, and deletion. |
| **Focus Session Flow** | Manual QA | Verified 25-min timer and seamless return to dashboard. |
| **Responsive Breakpoints** | Manual QA | Verified viewport layouts at 320px, 375px, 768px, 1024px, 1440px. |

---

## 15. Performance Optimizations

- **Parallelized Network Requests**: Consolidates independent Supabase table reads into `Promise.all` batches.
- **Explicit Column Projections**: Replaces `SELECT *` with targeted column queries (`id, title, deadline, importance, status`) to minimize payload bandwidth.
- **Deterministic Memoization**: Caches Next Best Action calculations using `useMemo` to eliminate unnecessary re-computations during state updates.
- **Vendor Chunk Splitting**: Bundles large third-party dependencies (`react`, `supabase`, `pdfjs-dist`) into separate cacheable chunks in `vite.config.js`, keeping the main application code bundle at **~157 kB** (34.7 kB gzipped).
- **Timeout Controls**: Fetch requests are bounded with `AbortController` timeouts to prevent hanging client states during backend cold starts.

---

## 16. Current Limitations

1. **Free-Tier Cold Starts**: The backend is hosted on Render's free tier, which enters sleep mode after 15 minutes of inactivity. The initial AI request may take 30–45 seconds to spin up.
2. **Third-Party AI Quotas**: AI question generation relies on external Google Gemini rate limits.
3. **LMS Sync**: Course schedules and syllabi are currently initialized via pre-loaded database schemas rather than real-time university LMS integrations (e.g., Canvas, Blackboard).

---

## 17. Roadmap

- [ ] **Google Calendar / Outlook Sync**: Two-way synchronization for assignment deadlines and exam countdowns.
- [ ] **LMS Integration**: Direct import of course assignments from Canvas / Google Classroom APIs.
- [ ] **RAG-Powered Note Search**: Vector embeddings for uploaded study PDFs using Supabase `pgvector`.
- [ ] **Spaced Repetition Flashcards**: SuperMemo SM-2 algorithmic scheduling for topic revision.
- [ ] **Native Mobile Application**: Cross-platform mobile companion app built with React Native.

---

## 18. License

This repository is maintained for educational, demonstration, and academic productivity purposes. Licensing terms should be selected in accordance with intended institutional or commercial deployment.
