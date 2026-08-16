# CoursePilot Security Architecture

This document details the security model, access control policies, multi-tenant isolation guarantees, and operational security practices implemented across CoursePilot.

---

## 1. Threat Model & Security Boundaries

```text
┌────────────────────────────────────────────────────────┐
│ UNTRUSTED CLIENT ENVIRONMENT (Browser)                 │
│ • React SPA execution                                  │
│ • Public anon key (VITE_SUPABASE_ANON_KEY)             │
│ • User JWT session managed by Supabase client          │
│ • IndexedDB local cache (user-partitioned)             │
└──────────────────┬───────────────────────────┬─────────┘
                   │ HTTPS (Direct + RLS)      │ HTTPS
                   ▼                           ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│ SUPABASE PLATFORM (Managed)   │ │ FASTAPI BACKEND      │
│ • Auth & Token Validation     │ │ • Server-side Proxy  │
│ • PostgreSQL 15 Database      │ │ • GEMINI_API_KEY     │
│ • Row Level Security (RLS)    │ │ • Request Validation │
│ • Private Storage Buckets     │ │ • Security Headers   │
└───────────────────────────────┘ └──────────┬───────────┘
                                             │ HTTPS
                                             ▼
                                  ┌──────────────────────┐
                                  │ GOOGLE GEMINI API    │
                                  └──────────────────────┘
```

---

## 2. Authentication & Session Management

- **Provider**: Supabase Auth (JSON Web Token based).
- **Session Tokens**: Authenticated users receive signed JWTs transmitted via standard `Authorization: Bearer <token>` headers on all API transactions.
- **Credential Storage**: Passwords are never stored in plaintext; hashing and salting are handled natively by PostgreSQL cryptographic extensions in Supabase Auth.
- **Shared Device Security**: When a user logs out (`handleLogout`), all React state arrays and user-scoped IndexedDB tables (`user_profile`, `student_topic_progress`, `sync_queue`) are completely purged (`clearUserScopedCache`), preventing cross-user data leakage on shared computers.

---

## 3. Database Multi-Tenancy & Row Level Security (RLS)

All student-facing tables in PostgreSQL enforce active **Row Level Security (RLS)**. Access permissions are verified directly at the database engine level, guaranteeing that a student can never read, modify, or delete another student's data—even if client-side parameters are forged.

### 3.1 Policy Implementations

| Table Name | RLS Status | Security Policy |
| :--- | :--- | :--- |
| `student_profiles` | **ACTIVE** | `SELECT`, `INSERT`, `UPDATE` strictly restricted to `auth.uid() = id`. |
| `student_topic_progress` | **ACTIVE** | Topic progress and mastery records scoped to `auth.uid() = user_id`. |
| `tasks` | **ACTIVE** | All CRUD operations require `auth.uid() = user_id`. |
| `exams` | **ACTIVE** | All CRUD operations require `auth.uid() = user_id`. |
| `study_sessions` | **ACTIVE** | Session logs and time records restricted to `auth.uid() = user_id`. |
| `study_materials` | **ACTIVE** | Document uploads and metadata restricted to `auth.uid() = user_id`. |
| `study_material_chunks` | **ACTIVE** | Vector chunks accessible only by the owning student (`auth.uid() = user_id`). |
| `study_packs` | **ACTIVE** | Generated study packs scoped to `auth.uid() = user_id`. |
| `study_flashcards` | **ACTIVE** | Flashcards and review ratings scoped to `auth.uid() = user_id`. |
| `exam_paper_analysis` | **ACTIVE** | Paper analysis reports scoped to `auth.uid() = user_id`. |
| `academic_subjects` | **PUBLIC READ** | Read-only access for curriculum schedule mapping. |
| `class_schedule` | **PUBLIC READ** | Read-only access for semester timetable lookup. |
| `syllabus_topics` | **PUBLIC READ** | Read-only access for syllabus topic trees. |

---

## 4. Cloud Storage Isolation

Course documents uploaded by students are stored in private Supabase Storage buckets:

- **User-Isolated Directory Paths**: Files are uploaded under a path prefix tied to the student's unique ID:
  ```text
  user_materials/${user.id}/${timestamp}-${sanitizedFileName}.pdf
  ```
- **Access Control**: Users can only query, download, and delete files within their designated `${user.id}/` folder prefix.
- **Signed URLs**: Downloads and previews utilize time-limited signed URLs generated on-demand.

---

## 5. Backend Proxy & API Key Protection

### 5.1 Server-Side Secret Isolation
- `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected exclusively into the FastAPI runtime environment on Render.
- Frontend source bundles and production builds are audited to guarantee **zero instances** of private LLM tokens, secret keys, or service role credentials.

### 5.2 Input Validation & Denial-of-Service Defense
- **Pydantic Validation**: Every backend endpoint validates request payloads against strict type contracts:
  - Text extraction payload: Enforced character bounds.
  - Topic / Subject strings: Enforced length bounds `[1, 200]` characters.
  - Question count: Bounded between `1` and `20`.
  - Mastery inputs: Clamped strictly to `[0, 100]` with finite number validation.
- **Client-Side File Ceiling**: PDF uploads exceeding **10MB** are rejected prior to network transmission.

### 5.3 HTTP Security Headers
All server responses from the FastAPI backend and Vercel CDN include standard defensive headers:
- `X-Content-Type-Options: nosniff` — Prevents MIME-type sniffing attacks.
- `X-Frame-Options: DENY` — Mitigates clickjacking attempts.
- `Referrer-Policy: strict-origin-when-cross-origin` — Protects token leakage in outbound referrer links.

---

## 6. Automated Security Verification

The repository includes an automated multi-user isolation verification script:
```bash
python scripts/verify_multi_user_isolation.py
```
This test asserts that:
1. User A (Section B2) and User B (Section K2) receive completely partitioned profiles, tasks, exams, study materials, and vector chunks.
2. Timetables are isolated by section while referencing consistent shared university curriculum tables.
3. RLS prevents any cross-tenant data leakage.
