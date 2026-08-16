# CoursePilot Database Architecture & Schema Reference

CoursePilot uses Supabase (PostgreSQL 15) with `pgvector` for Retrieval-Augmented Generation (RAG), coupled with strict Row-Level Security (RLS) policies.

---

## 1. Core University Academic Catalog (Public Read-Only)

These tables define the institutional academic structure (timetables, faculty, subjects, and syllabus hierarchy). They are read-only for authenticated students.

### `academic_sections`
Stores valid semester and section identifiers.
- `id` (bigint, PK)
- `semester` (integer)
- `section` (text, e.g. `'B2'`, `'A1'`)
- `created_at` (timestamptz)

### `academic_subjects`
Stores subject listings and metadata.
- `id` (bigint, PK)
- `subject_code` (text, e.g. `'CS201'`)
- `subject_name` (text, e.g. `'Data Structures & Algorithms'`)
- `semester` (integer)
- `section` (text)
- `created_at` (timestamptz)

### `class_schedule`
Stores scheduled weekly lectures.
- `id` (bigint, PK)
- `subject_id` (bigint, FK -> `academic_subjects.id`)
- `subject_name` (text)
- `subject_code` (text)
- `day_of_week` (text, e.g. `'Monday'`)
- `start_time` (time)
- `end_time` (time)
- `room_number` (text)
- `faculty_name` (text)
- `class_type` (text, `'Lecture'`)
- `semester` (integer)
- `section` (text)

### `lab_schedule`
Stores scheduled laboratory sessions.
- `id` (bigint, PK)
- `subject_id` (bigint, FK -> `academic_subjects.id`)
- `subject_name` (text)
- `subject_code` (text)
- `day_of_week` (text)
- `start_time` (time)
- `end_time` (time)
- `lab_name` (text)
- `faculty_name` (text)
- `batch` (text)
- `semester` (integer)
- `section` (text)

### `syllabus_topics`
Hierarchical topic breakdown per subject unit.
- `id` (bigint, PK)
- `subject_id` (bigint, FK -> `academic_subjects.id`)
- `unit_number` (integer)
- `topic_name` (text)
- `description` (text)
- `importance` (text, `'High' | 'Medium' | 'Low'`)

---

## 2. Student Workspace & Intelligence Tables (User-Scoped with RLS)

Every table below has Row Level Security (RLS) enabled. Students can only query, insert, update, or delete records where `user_id = auth.uid()`.

### `profiles` / `student_profiles`
Student account and semester enrollment profile.
- `id` (uuid, PK -> `auth.users.id`)
- `full_name` (text)
- `semester` (integer)
- `section` (text)
- `college_name` (text)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### `student_topic_progress`
Tracks student mastery ($0\% - 100\%$) on syllabus topics.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `syllabus_topic_id` (bigint, FK -> `syllabus_topics.id`)
- `mastery_score` (integer, 0-100)
- `status` (text, `'not_started' | 'in_progress' | 'mastered' | 'needs_revision'`)
- `last_studied_at` (timestamptz)
- `updated_at` (timestamptz)

### `topic_quiz_attempts` & `exam_quiz_attempts`
Records quiz history, answers, and mastery adjustments.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `syllabus_topic_id` (bigint, FK -> `syllabus_topics.id`)
- `score` (integer)
- `total_questions` (integer)
- `quiz_type` (text)
- `attempt_data` (jsonb)
- `created_at` (timestamptz)

### `tasks`
Student assignments, lab reports, and study items.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `title` (text)
- `subject` (text)
- `deadline` (timestamptz)
- `importance` (text, `'High' | 'Medium' | 'Low'`)
- `estimated_minutes` (integer)
- `status` (text, `'pending' | 'completed'`)
- `created_at` (timestamptz)

### `exams`
Upcoming midterms, finals, and practical assessments.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `subject` (text)
- `exam_date` (timestamptz)
- `importance` (text, `'High' | 'Medium' | 'Low'`)
- `created_at` (timestamptz)

### `study_sessions`
Records focus session history and Pomodoro focus duration.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `task_id` (bigint, FK -> `tasks.id`, optional)
- `duration_minutes` (integer)
- `completed` (boolean)
- `created_at` (timestamptz)

---

## 3. Study Material, RAG & AI Intelligence Schema

### `study_materials`
Uploaded student notes, lab manuals, and previous year papers.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `title` (text)
- `subject_id` (bigint, FK -> `academic_subjects.id`)
- `unit_number` (integer)
- `material_type` (text, `'Lecture Notes' | 'Reference' | 'Lab Manual' | 'Previous Year Paper'`)
- `file_path` (text, Supabase private storage key)
- `extracted_text` (text)
- `status` (text, `'ready' | 'processing' | 'error'`)
- `created_at` (timestamptz)

### `study_material_topics`
Auto-detected syllabus topic matches from extracted text.
- `id` (bigint, PK)
- `study_material_id` (bigint, FK -> `study_materials.id`)
- `syllabus_topic_id` (bigint, FK -> `syllabus_topics.id`)
- `confidence_score` (float)
- `created_at` (timestamptz)

### `study_material_chunks` (pgvector RAG)
Semantic text passages with 768-dimensional embeddings.
- `id` (bigint, PK)
- `study_material_id` (bigint, FK -> `study_materials.id`)
- `chunk_index` (integer)
- `page_number` (integer)
- `content` (text)
- `embedding` (vector(768))
- `created_at` (timestamptz)

### `study_packs`
Generated comprehensive study packs (summary, key concepts, definitions, high-yield points, revision checklist, practice questions).
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `study_material_id` (bigint, FK -> `study_materials.id`)
- `summary` (text)
- `key_concepts` (jsonb)
- `definitions` (jsonb)
- `high_yield_points` (jsonb)
- `common_confusions` (jsonb)
- `examples` (jsonb)
- `quick_revision` (jsonb)
- `practice_questions` (jsonb)
- `created_at` (timestamptz)

### `study_flashcards` & `flashcard_reviews`
Spaced-repetition flashcards generated from uploaded documents.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `study_material_id` (bigint, FK -> `study_materials.id`)
- `question` (text)
- `answer` (text)
- `topic` (text)
- `difficulty` (text)
- `interval_days` (integer)
- `repetition_count` (integer)
- `ease_factor` (float)
- `next_review_at` (timestamptz)

### `exam_paper_analysis`
Structured breakdown of previous year exam papers.
- `id` (bigint, PK)
- `user_id` (uuid, FK -> `auth.users.id`)
- `study_material_id` (bigint, FK -> `study_materials.id`, UNIQUE)
- `overview` (text)
- `frequent_topics` (jsonb)
- `unit_distribution` (jsonb)
- `repeated_concepts` (jsonb)
- `question_patterns` (jsonb)
- `difficulty_breakdown` (jsonb)
- `revision_recommendations` (jsonb)
- `created_at` (timestamptz)

### `copilot_conversations` & `copilot_messages`
Academic conversational assistant memory.
- `copilot_conversations`: `id`, `user_id`, `title`, `created_at`, `updated_at`
- `copilot_messages`: `id`, `conversation_id`, `user_id`, `role`, `content`, `actions` (jsonb), `sources` (jsonb), `created_at`

---

## 4. Vector Search PostgreSQL RPC Function

```sql
create or replace function match_study_material_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  target_study_material_id bigint default null
)
returns table (
  id bigint,
  study_material_id bigint,
  chunk_index int,
  page_number int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    smc.id,
    smc.study_material_id,
    smc.chunk_index,
    smc.page_number,
    smc.content,
    1 - (smc.embedding <=> query_embedding) as similarity
  from study_material_chunks smc
  where
    (target_study_material_id is null or smc.study_material_id = target_study_material_id)
    and 1 - (smc.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;
```
