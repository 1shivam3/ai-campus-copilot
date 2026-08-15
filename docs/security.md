# CoursePilot Security Architecture

This document details the security model, access control policies, data isolation guarantees, and operational practices implemented across CoursePilot.

---

## 1. Threat Model & Security Boundaries

```text
┌────────────────────────────────────────────────────────┐
│ UNTRUSTED CLIENT ENVIRONMENT (Browser)                 │
│ • React SPA execution                                  │
│ • Public anon key (VITE_SUPABASE_KEY)                  │
│ • User JWT stored in localStorage                      │
└──────────────────┬───────────────────────────┬─────────┘
                   │ HTTPS (Direct)            │ HTTPS
                   ▼                           ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│ SUPABASE PLATFORM (Managed)   │ │ FASTAPI BACKEND      │
│ • Auth & Token Validation     │ │ • Server-side Proxy  │
│ • PostgreSQL Database         │ │ • GEMINI_API_KEY     │
│ • Row Level Security (RLS)    │ │ • Request Validation │
│ • Storage Bucket Permissions  │ │ • Security Headers   │
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
- **Client Security**: No privileged administrative tokens or master keys exist on the client side.

---

## 3. Database Multi-Tenancy & Row Level Security (RLS)

All student-facing tables in PostgreSQL enforce active **Row Level Security (RLS)**. Access permissions are verified directly at the database engine level, guaranteeing that a student can never read, modify, or delete another student's data—even if client-side parameters are forged.

### 3.1 Policy Implementations

| Table Name | RLS Status | Security Policy |
| :--- | :--- | :--- |
| `student_profiles` | **ACTIVE** | `SELECT`, `INSERT`, `UPDATE` strictly restricted to `auth.uid() = id`. |
| `tasks` | **ACTIVE** | All CRUD operations require `auth.uid() = user_id`. |
| `exams` | **ACTIVE** | All CRUD operations require `auth.uid() = user_id`. |
| `topics` | **ACTIVE** | Topic progress and mastery records scoped to `auth.uid() = user_id`. |
| `study_sessions` | **ACTIVE** | Session logs and time records restricted to `auth.uid() = user_id`. |
| `academic_subjects` | **PUBLIC READ** | Read-only access for curriculum schedule mapping. |
| `class_schedule` | **PUBLIC READ** | Read-only access for semester timetable lookup. |
| `syllabus_topics` | **PUBLIC READ** | Read-only access for syllabus topic trees. |

---

## 4. Cloud Storage Isolation

Course documents uploaded by students are stored in the Supabase Storage bucket `study-material`.

- **User-Isolated Directory Paths**: Files are uploaded under a path prefix tied to the student's unique ID:
  ```text
  study-material/${user.id}/${timestamp}-${sanitizedFileName}.pdf
  ```
- **Access Control**: Users can only query and list files within their designated `${user.id}/` folder prefix.
- **File Deletion**: Storage file deletion commands require explicit match against the authenticated user's folder prefix.

---

## 5. Backend Proxy & API Key Protection

### 5.1 Server-Side Secret Isolation
- `GEMINI_API_KEY` is injected exclusively into the FastAPI runtime environment on Render.
- Frontend source bundles and production builds are audited to guarantee **zero instances** of private LLM tokens, secret keys, or service role credentials.

### 5.2 Input Validation & Denial-of-Service Defense
- **Pydantic Validation**: Every backend endpoint validates request payloads against strict type contracts:
  - Text extraction payload: Enforced maximum of `100,000` characters.
  - Topic / Subject strings: Enforced length bounds `[1, 200]` characters.
  - Question count: Bounded between `1` and `20`.
  - Mastery inputs: Clamped strictly to `[0, 100]` with `Number.isFinite` validation.
- **Client-Side File Ceiling**: PDF uploads exceeding **10MB** are rejected prior to network transmission.

### 5.3 HTTP Security Headers
All server responses from the FastAPI backend and Vercel CDN include standard defensive headers:
- `X-Content-Type-Options: nosniff` — Prevents MIME-type sniffing attacks.
- `X-Frame-Options: DENY` — Mitigates clickjacking attempts.
- `Referrer-Policy: strict-origin-when-cross-origin` — Protects token leakage in outbound referrer links.

---

## 6. Known Security Considerations & Limitations

1. **Third-Party AI Service Reliance**: AI responses are generated via external Google Gemini endpoints. While academic study content does not contain sensitive personally identifiable information (PII), students are advised not to upload documents containing confidential personal credentials.
2. **Deterministic Algorithm Privacy**: All priority scores and Next Best Action calculations run locally in the student's client browser, eliminating unnecessary transmissions of priority metadata.
