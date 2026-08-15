# AI Campus Copilot

> An AI-powered academic copilot that helps students decide what to study next, why it matters, and how to use their limited study time effectively.

## Problem

Students manage assignments, exams, notes and weak subjects across different places. Most productivity tools can store tasks, but they don't understand academic urgency or adapt to the student's actual performance.

## Solution

AI Campus Copilot combines:

- Assignments and deadlines
- Upcoming exams
- Topic mastery
- Study material
- AI-generated study strategies
- Focus sessions
- Adaptive progress

The system determines the student's **Next Best Action** and explains why it was prioritized.

## Core Features

### Next Best Action
Ranks academic activities using deadline urgency, importance, estimated effort and exam pressure.

### AI Academic Copilot
Generates personalized study strategies using the student's actual academic context.

### Exam Mode
Creates a focused revision strategy based on the upcoming exam, weakest topic and available study time.

### Study Material Analysis
Students can upload PDF study material and generate:
- Summaries
- Important topics
- Quick revision points
- Practice MCQs

### Focus Sessions
Students can start focused study sessions and track completed study time.

### Adaptive Topic Mastery
Completed study sessions update topic mastery, allowing future recommendations to adapt.

### Secure Student Accounts
Supabase Authentication and Row Level Security isolate each student's data.

## Architecture

```text
React + Tailwind
       |
       v
   Supabase
       |
       +---- Tasks
       +---- Exams
       +---- Topics
       +---- Study Sessions
       +---- Study Material
       |
       v
Priority Engine
       |
       v
AI Academic Copilot
       |
       v
FastAPI Backend
       |
       v
Gemini API
```

## Tech Stack

### Frontend
- React
- Vite
- Tailwind CSS

### Backend
- Python
- FastAPI

### Database & Authentication
- Supabase (PostgreSQL)
- Supabase Auth
- Row Level Security (RLS)

### AI
- Gemini API (via FastAPI proxy)

### Deployment
- Vercel / Netlify (Frontend)
- FastAPI-compatible hosting (Render / Railway)

## Project Structure

```text
ai-campus-copilot/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Local Setup

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Create environment files using the provided `.env.example` files:
- `frontend/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`
- `backend/.env` with `GEMINI_API_KEY`

## Security

- API secrets are stored exclusively in environment variables and are excluded from the repository.
- Supabase Row Level Security (RLS) and storage policies ensure complete tenant isolation per student.

## Future Improvements

- Retrieval-augmented generation (RAG) for large multi-document study libraries
- Google Calendar and LMS canvas integration
- Advanced mastery regression modelling
- Real-time study notifications & streak reminders
- Native mobile application
- University timetable parsing
