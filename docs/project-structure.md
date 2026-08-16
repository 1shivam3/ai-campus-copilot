# CoursePilot Project Structure

This document provides a directory and file organization map of the CoursePilot codebase.

---

## Root Layout

```text
ai-campus-copilot/
├── README.md                           # Master project documentation
├── requirements.txt                    # Backend Python dependencies
├── import_academic_data_complete.py    # Authoritative academic data import script
├── cse-3rd-sem-timetable(1).json       # Authoritative Semester 3 CSE timetable JSON
├── docs/                               # System and technical documentation
│   ├── api.md                          # FastAPI endpoint specifications
│   ├── architecture.md                 # System architecture and data flow diagrams
│   ├── database.md                     # Supabase & PostgreSQL schema reference
│   ├── security.md                     # Security boundaries and RLS policies
│   ├── demo-script.md                  # Evaluation demonstration scripts
│   └── presentation.md                 # Slide presentation guide
├── backend/                            # FastAPI Python Backend
│   ├── main.py                         # Application entrypoint & REST endpoints
│   ├── services/
│   │   ├── copilot_context.py          # Academic state context aggregation engine
│   │   └── rag_engine.py               # Document chunking & vector embedding service
│   └── test_*.py                       # Unit and endpoint validation tests
├── frontend/                           # React 19 + Vite Frontend
│   ├── index.html                      # App shell entry HTML & SEO tags
│   ├── package.json                    # Frontend dependencies & scripts
│   ├── vite.config.js                  # Vite configuration & manual chunking
│   ├── public/
│   │   ├── manifest.webmanifest        # PWA Web App Manifest
│   │   └── sw.js                       # PWA Service Worker (App Shell caching)
│   └── src/
│       ├── main.jsx                    # React root mount
│       ├── App.jsx                     # Application state, routing, and sync coordinator
│       ├── index.css                   # Tailwind CSS v4 design system tokens
│       ├── components/                 # Reusable UI widgets
│       │   ├── Sidebar.jsx             # Desktop sidebar navigation
│       │   ├── MobileBottomNav.jsx     # Fixed mobile bottom navigation
│       │   ├── HomeHeader.jsx          # Header with stats and search trigger
│       │   ├── TodayTimetableStrip.jsx # Horizontal today's classes strip
│       │   ├── DailyProgressCard.jsx   # 5-Question challenge card
│       │   ├── NotificationCenter.jsx  # In-app notifications tray
│       │   ├── GlobalSearch.jsx        # Ctrl+K global academic search modal
│       │   ├── PWAInstallBanner.jsx    # Progressive web app install trigger
│       │   └── SkeletonLoader.jsx      # Loading state placeholders
│       ├── pages/                      # Page-level route views
│       │   ├── Auth.jsx                # Student signup and login
│       │   ├── ProfileSetup.jsx        # First-time semester/section onboarding
│       │   ├── LandingPage.jsx         # Product overview landing page
│       │   ├── MyAcademics.jsx         # Weekly timetable matrix (Mon–Fri)
│       │   ├── Syllabus.jsx            # Course syllabus & unit explorer
│       │   ├── Progress.jsx            # Topic progress & mastery tracker
│       │   ├── Tasks.jsx               # Student assignment management
│       │   ├── Exams.jsx               # Exam schedule tracking
│       │   ├── ExamMode.jsx            # Exam readiness & AI practice quizzes
│       │   ├── StudyMaterial.jsx       # Document hub & PDF uploader
│       │   ├── StudyMaterialReader.jsx # Grounded RAG reader ("Ask This Material")
│       │   ├── StudyPack.jsx           # 7-Part AI study pack viewer
│       │   ├── Flashcards.jsx          # SM-2 spaced repetition flashcards
│       │   ├── ExamPaperAnalysis.jsx   # Previous-year exam paper analyzer
│       │   ├── FocusSession.jsx        # Pomodoro study timer
│       │   ├── Leaderboard.jsx         # Campus XP leaderboard
│       │   └── MyProfile.jsx           # Profile & cross-device settings
│       ├── lib/                        # Client libraries & infrastructure
│       │   ├── supabase.js             # Supabase client instance
│       │   ├── api.js                  # FastAPI backend client wrapper
│       │   ├── offlineDb.js            # Dexie IndexedDB client & store schema
│       │   ├── syncQueue.js            # Offline mutation queue & auto-sync engine
│       │   ├── academicData.js         # Cache-first schedule & subject fetcher
│       │   └── todaySchedule.js        # Today's classes & next class calculator
│       └── utils/                      # Pure helper algorithms
│           ├── nextBestActionEngine.js # Deterministic priority scoring algorithm
│           ├── freeTime.js             # Free study window detection
│           ├── syllabusProgress.js     # Topic mastery calculations
│           ├── examReadiness.js        # Exam readiness index formula
│           ├── xpEngine.js             # XP transaction aggregation
│           ├── streakEngine.js         # Daily streak calculation
│           ├── badgeEngine.js          # Achievement badge evaluation
│           ├── dailyChallengeEngine.js # 5-question daily challenge set generator
│           ├── notificationEngine.js   # Notification deduplication & quiet hours
│           └── theme.js                # Theme & appearance management
└── scripts/                            # Verification & audit scripts
    ├── run_all_tests.py                # Master backend integration test suite
    ├── verify_database_integrity.py    # Database timetable & schema audit
    ├── verify_multi_user_isolation.py  # Multi-tenant isolation test suite
    └── verify_offline_architecture.js  # Dexie IndexedDB offline architecture test
```
