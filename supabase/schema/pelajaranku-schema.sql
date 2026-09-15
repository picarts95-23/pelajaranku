-- =====================================================================
-- Pelajaranku - SKEMA SUPABASE LENGKAP (satu file, sekali jalan)
-- =====================================================================
-- Cara pakai:
--   1. Buka Supabase Anda -> SQL Editor -> New query
--   2. Tempel SELURUH isi file ini, klik RUN
--   3. Tunggu "Success". Aman dijalankan ulang (idempotent).
-- Lalu buat 3 bucket PRIVATE di Storage:
--   answer-images, voice-answers, lesson-media
-- =====================================================================
SET statement_timeout = 0;
SET client_min_messages = warning;
SET check_function_bodies = off;
-- ============ EXTENSIONS ============
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip ext %', 'uuid-ossp'; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip ext %', 'pgcrypto'; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_cron; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip ext %', 'pg_cron'; END $$;
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pg_net; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip ext %', 'pg_net'; END $$;

-- ============ ENUM TYPES ============
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('guru', 'siswa', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.attendance_status AS ENUM ('hadir', 'izin', 'sakit', 'alpa'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.question_type AS ENUM ('multiple_choice', 'essay', 'true_false', 'voice', 'complex_multiple_choice', 'short_answer', 'image'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.submission_status AS ENUM ('draft', 'submitted', 'graded', 'returned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.task_request_status AS ENUM ('pending', 'accepted', 'declined', 'converted', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.adab_scores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject text NOT NULL,
  score integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.announcement_reactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.annual_programs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid,
  subject text,
  academic_year text,
  title text DEFAULT 'Program Tahunan'::text NOT NULL,
  notes text,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text DEFAULT 'singleton'::text NOT NULL,
  teacher_signup_mode text DEFAULT 'invite'::text NOT NULL,
  teacher_access_code text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_by uuid
);
CREATE TABLE IF NOT EXISTS public.assignment_answer_keys (
  assignment_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  answer_key text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  due_at timestamp with time zone,
  max_score integer DEFAULT 100 NOT NULL,
  xp_reward integer DEFAULT 50 NOT NULL,
  coin_reward integer DEFAULT 10 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  assigned_student_id uuid,
  quiz_link text,
  game_link text,
  answer_format text DEFAULT 'descriptive'::text NOT NULL,
  options jsonb,
  muroja_juz text,
  muroja_surah text,
  muroja_ayat text,
  subject text,
  exam_type text DEFAULT 'harian'::text NOT NULL,
  questions jsonb,
  halaqoh_kind text,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  interactive_mode boolean DEFAULT false NOT NULL,
  question_time_limit integer,
  CONSTRAINT assignments_question_time_limit_check CHECK ((question_time_limit IS NULL) OR ((question_time_limit >= 10) AND (question_time_limit <= 300)))
);
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  date date NOT NULL,
  status attendance_status DEFAULT 'hadir'::attendance_status NOT NULL,
  note text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.attendance_settings (
  teacher_id uuid NOT NULL,
  hadir integer DEFAULT 100 NOT NULL,
  izin integer DEFAULT 50 NOT NULL,
  sakit integer DEFAULT 50 NOT NULL,
  alpa integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  xp_requirement integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.class_activities (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  subject text,
  academic_year text,
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  subjects text[] DEFAULT '{}'::text[] NOT NULL
);
CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  start_at timestamp with time zone NOT NULL,
  end_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  quiz_link text,
  game_link text,
  google_event_id text
);
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.journals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  class_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  topic text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  subject text,
  student_id uuid
);
CREATE TABLE IF NOT EXISTS public.lesson_plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid,
  subject text,
  week_label text,
  start_date date DEFAULT (now())::date NOT NULL,
  end_date date,
  objectives text,
  materials text,
  methods text,
  media text,
  assessment text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.material_reads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  material_id uuid NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid,
  subject text,
  title text NOT NULL,
  description text,
  content text,
  link text,
  file_url text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  media_type text,
  media_url text,
  attachment_url text,
  attachment_name text,
  attachment_type text
);
CREATE TABLE IF NOT EXISTS public.peer_reactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  target_student_id uuid NOT NULL,
  reactor_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.profile_private (
  id uuid NOT NULL,
  school_id_number text,
  gender text,
  birthdate date,
  hobby text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  class_name text,
  subject text,
  xp integer DEFAULT 0 NOT NULL,
  level integer DEFAULT 1 NOT NULL,
  coins integer DEFAULT 100 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  username text,
  bio text,
  motto text,
  character_key text,
  archived_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.question_bank (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  subject text,
  topic text,
  question text NOT NULL,
  type question_type DEFAULT 'multiple_choice'::question_type NOT NULL,
  options jsonb,
  answer text,
  difficulty question_difficulty DEFAULT 'medium'::question_difficulty NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  quiz_link text,
  game_link text,
  image_url text,
  grade_level text,
  halaqoh_kind text,
  setoran_kind text,
  min_pages integer,
  exam_category text DEFAULT 'harian'::text NOT NULL,
  stimulus text,
  points numeric,
  time_limit_seconds integer,
  indicator text
);
CREATE TABLE IF NOT EXISTS public.semester_programs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid,
  subject text,
  academic_year text,
  semester integer DEFAULT 1 NOT NULL,
  title text DEFAULT 'Program Semester'::text NOT NULL,
  notes text,
  items jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.sheet_sync_state (
  id integer DEFAULT 1 NOT NULL,
  spreadsheet_id text,
  spreadsheet_url text,
  last_synced_at timestamp with time zone,
  last_status text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.status_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  status_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.status_reactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  status_id uuid NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.statuses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  mood text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.submission_grade_revisions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  submission_id uuid NOT NULL,
  score integer,
  feedback text,
  feedback_media_type text,
  feedback_media_url text,
  status text,
  revised_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  content text,
  file_url text,
  status submission_status DEFAULT 'submitted'::submission_status NOT NULL,
  score integer,
  feedback text,
  submitted_at timestamp with time zone DEFAULT now() NOT NULL,
  graded_at timestamp with time zone,
  graded_by uuid,
  reward_granted boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  feedback_media_type text,
  feedback_media_url text,
  score_breakdown jsonb
);
CREATE TABLE IF NOT EXISTS public.tahfidz_mutabaah (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid,
  session_date date DEFAULT CURRENT_DATE NOT NULL,
  session_type text DEFAULT 'ziyadah'::text NOT NULL,
  surah text,
  ayat_from integer,
  ayat_to integer,
  juz integer,
  tajwid_score integer DEFAULT 0 NOT NULL,
  tajwid_errors integer DEFAULT 0 NOT NULL,
  kelancaran_score integer DEFAULT 0 NOT NULL,
  kelancaran_helps integer DEFAULT 0 NOT NULL,
  fashohah_score integer DEFAULT 0 NOT NULL,
  adab_aurat boolean DEFAULT true NOT NULL,
  adab_focus boolean DEFAULT true NOT NULL,
  adab_etika boolean DEFAULT true NOT NULL,
  total_score integer DEFAULT 0 NOT NULL,
  predikat text,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  setoran_kind text,
  pages_count numeric,
  iqro_jilid integer,
  iqro_page integer,
  iqro_letters text[]
);
CREATE TABLE IF NOT EXISTS public.task_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid,
  class_id uuid,
  subject text,
  title text NOT NULL,
  description text,
  desired_due_at timestamp with time zone,
  status task_request_status DEFAULT 'pending'::task_request_status NOT NULL,
  teacher_note text,
  assignment_id uuid,
  responded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.teacher_calendar_feeds (
  user_id uuid NOT NULL,
  token text DEFAULT (replace((gen_random_uuid())::text, '-'::text, ''::text) || replace((gen_random_uuid())::text, '-'::text, ''::text)) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.teacher_invites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  note text,
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.teacher_sheet_sync (
  teacher_id uuid NOT NULL,
  spreadsheet_id text,
  spreadsheet_url text,
  last_synced_at timestamp with time zone,
  last_status text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  teacher_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL,
  earned_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_id uuid,
  xp_amount integer DEFAULT 0 NOT NULL,
  coin_amount integer DEFAULT 0 NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============ CONSTRAINTS ============
DO $$ BEGIN EXECUTE 'ALTER TABLE public.adab_scores ADD CONSTRAINT adab_scores_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_comments ADD CONSTRAINT announcement_comments_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_reactions ADD CONSTRAINT announcement_reactions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.annual_programs ADD CONSTRAINT annual_programs_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignment_answer_keys ADD CONSTRAINT assignment_answer_keys_pkey PRIMARY KEY (assignment_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance_settings ADD CONSTRAINT attendance_settings_pkey PRIMARY KEY (teacher_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.badges ADD CONSTRAINT badges_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_activities ADD CONSTRAINT class_activities_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.classes ADD CONSTRAINT classes_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.events ADD CONSTRAINT events_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.google_calendar_connections ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.journals ADD CONSTRAINT journals_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.lesson_plans ADD CONSTRAINT lesson_plans_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.material_reads ADD CONSTRAINT material_reads_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.materials ADD CONSTRAINT materials_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.peer_reactions ADD CONSTRAINT peer_reactions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.profile_private ADD CONSTRAINT profile_private_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.semester_programs ADD CONSTRAINT semester_programs_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.sheet_sync_state ADD CONSTRAINT sheet_sync_state_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_comments ADD CONSTRAINT status_comments_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_reactions ADD CONSTRAINT status_reactions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.statuses ADD CONSTRAINT statuses_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submission_grade_revisions ADD CONSTRAINT submission_grade_revisions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submissions ADD CONSTRAINT submissions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.tahfidz_mutabaah ADD CONSTRAINT tahfidz_mutabaah_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.task_requests ADD CONSTRAINT task_requests_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_calendar_feeds ADD CONSTRAINT teacher_calendar_feeds_pkey PRIMARY KEY (user_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_invites ADD CONSTRAINT teacher_invites_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_sheet_sync ADD CONSTRAINT teacher_sheet_sync_pkey PRIMARY KEY (teacher_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_subjects ADD CONSTRAINT teacher_subjects_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.xp_transactions ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.adab_scores ADD CONSTRAINT adab_scores_teacher_id_student_id_class_id_subject_key UNIQUE (teacher_id, student_id, class_id, subject)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_reactions ADD CONSTRAINT announcement_reactions_announcement_id_user_id_key UNIQUE (announcement_id, user_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT attendance_class_id_student_id_date_key UNIQUE (class_id, student_id, date)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.badges ADD CONSTRAINT badges_code_key UNIQUE (code)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_class_id_student_id_key UNIQUE (class_id, student_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.classes ADD CONSTRAINT classes_code_key UNIQUE (code)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.google_calendar_connections ADD CONSTRAINT google_calendar_connections_user_id_key UNIQUE (user_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.material_reads ADD CONSTRAINT material_reads_user_id_material_id_key UNIQUE (user_id, material_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.peer_reactions ADD CONSTRAINT peer_reactions_target_student_id_reactor_id_emoji_key UNIQUE (target_student_id, reactor_id, emoji)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_reactions ADD CONSTRAINT status_reactions_status_id_user_id_emoji_key UNIQUE (status_id, user_id, emoji)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submissions ADD CONSTRAINT submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_calendar_feeds ADD CONSTRAINT teacher_calendar_feeds_token_key UNIQUE (token)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_invites ADD CONSTRAINT teacher_invites_code_key UNIQUE (code)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_subjects ADD CONSTRAINT teacher_subjects_teacher_id_name_key UNIQUE (teacher_id, name)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_id_check CHECK ((id = ''singleton''::text))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_teacher_signup_mode_check CHECK ((teacher_signup_mode = ANY (ARRAY[''auto''::text, ''invite''::text, ''closed''::text])))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_exam_type_check CHECK ((exam_type = ANY (ARRAY[''harian''::text, ''uts''::text, ''uas''::text])))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_target_check CHECK (((class_id IS NOT NULL) OR (assigned_student_id IS NOT NULL)))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_exam_category_check CHECK ((exam_category = ANY (ARRAY[''harian''::text, ''uts''::text, ''uas''::text, ''halaqoh''::text])))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_points_check CHECK (points IS NULL OR (points > 0 AND points <= 1000))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_time_limit_seconds_check CHECK (time_limit_seconds IS NULL OR (time_limit_seconds >= 10 AND time_limit_seconds <= 600))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.sheet_sync_state ADD CONSTRAINT sheet_sync_singleton CHECK ((id = 1))'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.adab_scores ADD CONSTRAINT adab_scores_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.adab_scores ADD CONSTRAINT adab_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.adab_scores ADD CONSTRAINT adab_scores_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_comments ADD CONSTRAINT announcement_comments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_comments ADD CONSTRAINT announcement_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_reactions ADD CONSTRAINT announcement_reactions_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcement_reactions ADD CONSTRAINT announcement_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcements ADD CONSTRAINT announcements_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.announcements ADD CONSTRAINT announcements_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.annual_programs ADD CONSTRAINT annual_programs_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.annual_programs ADD CONSTRAINT annual_programs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignment_answer_keys ADD CONSTRAINT assignment_answer_keys_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_assigned_student_id_fkey FOREIGN KEY (assigned_student_id) REFERENCES profiles(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.assignments ADD CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.attendance_settings ADD CONSTRAINT attendance_settings_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_activities ADD CONSTRAINT class_activities_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_activities ADD CONSTRAINT class_activities_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_activities ADD CONSTRAINT class_activities_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.class_enrollments ADD CONSTRAINT class_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.classes ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.events ADD CONSTRAINT events_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.events ADD CONSTRAINT events_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.google_calendar_connections ADD CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.journals ADD CONSTRAINT journals_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.journals ADD CONSTRAINT journals_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.journals ADD CONSTRAINT journals_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.lesson_plans ADD CONSTRAINT lesson_plans_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.lesson_plans ADD CONSTRAINT lesson_plans_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.material_reads ADD CONSTRAINT material_reads_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.material_reads ADD CONSTRAINT material_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.materials ADD CONSTRAINT materials_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.materials ADD CONSTRAINT materials_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.peer_reactions ADD CONSTRAINT peer_reactions_reactor_id_fkey FOREIGN KEY (reactor_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.peer_reactions ADD CONSTRAINT peer_reactions_target_student_id_fkey FOREIGN KEY (target_student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.profile_private ADD CONSTRAINT profile_private_id_fkey FOREIGN KEY (id) REFERENCES profiles(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.semester_programs ADD CONSTRAINT semester_programs_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.semester_programs ADD CONSTRAINT semester_programs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_comments ADD CONSTRAINT status_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_comments ADD CONSTRAINT status_comments_status_id_fkey FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_reactions ADD CONSTRAINT status_reactions_status_id_fkey FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.status_reactions ADD CONSTRAINT status_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.statuses ADD CONSTRAINT statuses_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submission_grade_revisions ADD CONSTRAINT submission_grade_revisions_revised_by_fkey FOREIGN KEY (revised_by) REFERENCES auth.users(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submission_grade_revisions ADD CONSTRAINT submission_grade_revisions_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submissions ADD CONSTRAINT submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submissions ADD CONSTRAINT submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES auth.users(id)'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.submissions ADD CONSTRAINT submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.tahfidz_mutabaah ADD CONSTRAINT tahfidz_mutabaah_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.tahfidz_mutabaah ADD CONSTRAINT tahfidz_mutabaah_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.tahfidz_mutabaah ADD CONSTRAINT tahfidz_mutabaah_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.task_requests ADD CONSTRAINT task_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.task_requests ADD CONSTRAINT task_requests_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.task_requests ADD CONSTRAINT task_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.task_requests ADD CONSTRAINT task_requests_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_calendar_feeds ADD CONSTRAINT teacher_calendar_feeds_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_invites ADD CONSTRAINT teacher_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_invites ADD CONSTRAINT teacher_invites_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_sheet_sync ADD CONSTRAINT teacher_sheet_sync_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.teacher_subjects ADD CONSTRAINT teacher_subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'ALTER TABLE public.xp_transactions ADD CONSTRAINT xp_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'; EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; WHEN invalid_table_definition THEN NULL; END $$;

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS class_activities_class_id_created_at_idx ON public.class_activities USING btree (class_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles USING btree (lower(username)) WHERE (username IS NOT NULL);
CREATE INDEX IF NOT EXISTS submission_grade_revisions_submission_id_created_at_idx ON public.submission_grade_revisions USING btree (submission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_requests_class_idx ON public.task_requests USING btree (class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_requests_student_idx ON public.task_requests USING btree (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_requests_teacher_idx ON public.task_requests USING btree (teacher_id, created_at DESC);

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.can_view_status(_status_id uuid, _uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.statuses s
    WHERE s.id = _status_id
      AND (s.author_id = _uid OR public.shares_class_with(_uid, s.author_id))
  )
$function$
;
CREATE OR REPLACE FUNCTION public.get_teacher_signup_mode()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT teacher_signup_mode FROM public.app_settings WHERE id = 'singleton'
$function$
;
CREATE OR REPLACE FUNCTION public.grade_quiz_submission(_assignment_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _a public.assignments;
  _key jsonb;
  _total int;
  _auto_correct int := 0;
  _manual_pending int := 0;
  _earned_weight numeric := 0;
  _total_weight numeric := 0;
  _question_weight numeric;
  _score int;
  _status submission_status;
  _i int;
  _type text;
  _stud text;
  _accepted text;
  _ok boolean;
  _indicator text;
  _breakdown jsonb := '{}'::jsonb;
  _bucket jsonb;
  _breakdown_array jsonb;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'siswa') THEN RAISE EXCEPTION 'NOT_A_STUDENT'; END IF;

  SELECT * INTO _a FROM public.assignments WHERE id = _assignment_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;

  IF _a.due_at IS NOT NULL AND _a.due_at <= now() THEN
    RAISE EXCEPTION 'DEADLINE_PASSED';
  END IF;

  IF _a.assigned_student_id IS NOT NULL THEN
    IF _a.assigned_student_id <> _uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  ELSIF _a.class_id IS NOT NULL THEN
    IF NOT public.is_class_member(_a.class_id, _uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.submissions WHERE assignment_id = _assignment_id AND student_id = _uid) THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED';
  END IF;

  SELECT answer_key::jsonb INTO _key FROM public.assignment_answer_keys WHERE assignment_id = _assignment_id;
  IF _key IS NULL THEN RAISE EXCEPTION 'NO_ANSWER_KEY'; END IF;

  _total := jsonb_array_length(_a.questions);
  IF _total IS NULL OR _total = 0 THEN RAISE EXCEPTION 'NO_QUESTIONS'; END IF;

  FOR _i IN 0.._total - 1 LOOP
    _question_weight := COALESCE(NULLIF(_a.questions -> _i ->> 'points', '')::numeric, 1);
    IF _question_weight <= 0 THEN _question_weight := 1; END IF;
    _total_weight := _total_weight + _question_weight;
  END LOOP;

  FOR _i IN 0.._total - 1 LOOP
    _type := COALESCE(_a.questions -> _i ->> 'type', 'multiple_choice');
    _question_weight := COALESCE(NULLIF(_a.questions -> _i ->> 'points', '')::numeric, 1);
    IF _question_weight <= 0 THEN _question_weight := 1; END IF;
    _indicator := COALESCE(NULLIF(btrim(_a.questions -> _i ->> 'indicator'), ''), 'Umum');
    _bucket := COALESCE(_breakdown -> _indicator, jsonb_build_object('indicator', _indicator, 'correct', 0, 'total', 0, 'earned_points', 0, 'max_points', 0, 'manual_pending', 0));
    _bucket := jsonb_set(_bucket, '{total}', to_jsonb(COALESCE((_bucket ->> 'total')::int, 0) + 1));
    _bucket := jsonb_set(_bucket, '{max_points}', to_jsonb(COALESCE((_bucket ->> 'max_points')::numeric, 0) + _question_weight));

    IF _type IN ('essay', 'voice', 'image') THEN
      _manual_pending := _manual_pending + 1;
      _bucket := jsonb_set(_bucket, '{manual_pending}', to_jsonb(COALESCE((_bucket ->> 'manual_pending')::int, 0) + 1));
      _breakdown := jsonb_set(_breakdown, ARRAY[_indicator], _bucket, true);
      CONTINUE;
    END IF;

    _stud := _answers ->> _i;
    _ok := false;

    IF _stud IS NOT NULL AND btrim(_stud) <> '' THEN
      IF _type = 'short_answer' THEN
        FOREACH _accepted IN ARRAY string_to_array(COALESCE(_key ->> _i, ''), '|') LOOP
          IF lower(btrim(_stud)) = lower(btrim(_accepted)) AND btrim(_accepted) <> '' THEN
            _ok := true;
          END IF;
        END LOOP;
      ELSE
        IF lower(btrim(_stud)) = lower(btrim(COALESCE(_key ->> _i, ''))) THEN
          _ok := true;
        END IF;
      END IF;
    END IF;

    IF _ok THEN
      _auto_correct := _auto_correct + 1;
      _earned_weight := _earned_weight + _question_weight;
      _bucket := jsonb_set(_bucket, '{correct}', to_jsonb(COALESCE((_bucket ->> 'correct')::int, 0) + 1));
      _bucket := jsonb_set(_bucket, '{earned_points}', to_jsonb(COALESCE((_bucket ->> 'earned_points')::numeric, 0) + _question_weight));
    END IF;
    _breakdown := jsonb_set(_breakdown, ARRAY[_indicator], _bucket, true);
  END LOOP;

  SELECT COALESCE(jsonb_agg(value ORDER BY key), '[]'::jsonb) INTO _breakdown_array FROM jsonb_each(_breakdown);
  _score := CASE WHEN _total_weight > 0 THEN round((_earned_weight / _total_weight) * _a.max_score) ELSE 0 END;
  _status := CASE WHEN _manual_pending > 0 THEN 'submitted'::submission_status ELSE 'graded'::submission_status END;

  PERFORM set_config('app.autograde', '1', true);

  INSERT INTO public.submissions (assignment_id, student_id, content, status, score, score_breakdown, submitted_at)
  VALUES (_assignment_id, _uid, _answers::text, _status, _score, _breakdown_array, now());

  IF _manual_pending = 0 THEN
    UPDATE public.submissions
      SET graded_by = _a.teacher_id, graded_at = now()
      WHERE assignment_id = _assignment_id AND student_id = _uid;
  END IF;

  RETURN jsonb_build_object(
    'auto_correct', _auto_correct,
    'total', _total,
    'manual_pending', _manual_pending,
    'score', _score,
    'max_score', _a.max_score,
    'status', _status,
    'breakdown', _breakdown_array
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.grant_submission_rewards()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _xp integer; _coin integer; _max integer; _ratio numeric;
BEGIN
  IF NEW.status = 'graded' AND COALESCE(OLD.reward_granted, false) = false AND NEW.score IS NOT NULL THEN
    SELECT xp_reward, coin_reward, max_score INTO _xp, _coin, _max
      FROM public.assignments WHERE id = NEW.assignment_id;
    _ratio := LEAST(1.0, GREATEST(0.0, NEW.score::numeric / NULLIF(_max,0)));
    _xp := FLOOR(_xp * _ratio)::integer;
    _coin := FLOOR(_coin * _ratio)::integer;

    UPDATE public.profiles
      SET xp = xp + _xp,
          coins = coins + _coin,
          level = GREATEST(1, FLOOR((xp + _xp) / 100.0)::integer + 1)
      WHERE id = NEW.student_id;

    INSERT INTO public.xp_transactions (user_id, source, source_id, xp_amount, coin_amount, note)
      VALUES (NEW.student_id, 'assignment', NEW.assignment_id, _xp, _coin, 'Reward tugas dinilai');

    NEW.reward_granted := true;
    NEW.graded_at := COALESCE(NEW.graded_at, now());
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.halaqoh_daily_scores(_class_id uuid)
 RETURNS TABLE(student_id uuid, ziyadah numeric, murojaah numeric, tilawah numeric, daily numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  IF NOT public.is_class_owner(_class_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH src AS (
    SELECT m.student_id AS sid,
           CASE
             WHEN lower(coalesce(m.session_type, '')) LIKE 'ziyadah%' THEN 'ziyadah'
             WHEN lower(coalesce(m.session_type, '')) LIKE 'muroj%'
               OR lower(coalesce(m.session_type, '')) LIKE 'muraj%' THEN 'murojaah'
             WHEN lower(coalesce(m.session_type, '')) LIKE 'tilawah%' THEN 'tilawah'
             ELSE 'ziyadah'
           END AS kind,
           m.total_score::numeric AS score
    FROM public.tahfidz_mutabaah m
    WHERE m.class_id = _class_id
    UNION ALL
    SELECT s.student_id AS sid,
           lower(a.halaqoh_kind) AS kind,
           CASE WHEN a.max_score > 0 THEN (s.score::numeric / a.max_score) * 100 ELSE 0 END AS score
    FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE a.class_id = _class_id
      AND lower(coalesce(a.halaqoh_kind, '')) IN ('ziyadah', 'murojaah', 'tilawah')
      AND s.status = 'graded'
      AND s.score IS NOT NULL
  ),
  agg AS (
    SELECT src.sid,
           avg(src.score) FILTER (WHERE src.kind = 'ziyadah')  AS z,
           avg(src.score) FILTER (WHERE src.kind = 'murojaah') AS m,
           avg(src.score) FILTER (WHERE src.kind = 'tilawah')  AS t
    FROM src
    GROUP BY src.sid
  )
  SELECT agg.sid,
         round(coalesce(agg.z, 0))::numeric,
         round(coalesce(agg.m, 0))::numeric,
         round(coalesce(agg.t, 0))::numeric,
         round(
           CASE
             WHEN (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END
                 + CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END
                 + CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END) = 0 THEN 0
             ELSE (coalesce(agg.z, 0) * (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END)
                 + coalesce(agg.m, 0) * (CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END)
                 + coalesce(agg.t, 0) * (CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END))
                 / (CASE WHEN agg.z IS NOT NULL THEN 0.30 ELSE 0 END
                  + CASE WHEN agg.m IS NOT NULL THEN 0.40 ELSE 0 END
                  + CASE WHEN agg.t IS NOT NULL THEN 0.30 ELSE 0 END)
           END
         )::numeric
  FROM agg;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, class_name, subject)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'class_name',
    NEW.raw_user_meta_data->>'subject'
  );

  INSERT INTO public.profile_private (id, school_id_number)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'school_id_number');

  -- Role is NEVER read from client metadata: everyone starts as a student.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$
;
CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
    UNION
    SELECT 1 FROM public.class_enrollments WHERE class_id = _class_id AND student_id = _user_id
  )
$function$
;
CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id)
$function$
;
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
 RETURNS classes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cls public.classes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'siswa') THEN
    RAISE EXCEPTION 'NOT_A_STUDENT';
  END IF;

  SELECT * INTO _cls
  FROM public.classes
  WHERE upper(code) = upper(btrim(_code))
  LIMIT 1;

  IF _cls.id IS NULL THEN
    RAISE EXCEPTION 'CLASS_NOT_FOUND';
  END IF;

  INSERT INTO public.class_enrollments (class_id, student_id)
  VALUES (_cls.id, auth.uid())
  ON CONFLICT (class_id, student_id) DO NOTHING;

  RETURN _cls;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.list_students()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, class_name text, subject text, xp integer, level integer, coins integer, username text, bio text, motto text, character_key text, created_at timestamp with time zone, updated_at timestamp with time zone, school_id_number text, gender text, birthdate date, hobby text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.class_name, p.subject,
         p.xp, p.level, p.coins, p.username, p.bio,
         p.motto, p.character_key, p.created_at, p.updated_at,
         pp.school_id_number, pp.gender, pp.birthdate, pp.hobby
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE p.archived_at IS NULL
  ORDER BY p.full_name;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_class_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.class_activities (class_id, actor_id, action, metadata)
  VALUES (
    NEW.id,
    NEW.teacher_id,
    'class_created',
    jsonb_build_object('name', NEW.name, 'code', NEW.code)
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_enrollment_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _actor uuid;
BEGIN
  _actor := COALESCE(auth.uid(), NEW.student_id);
  INSERT INTO public.class_activities (class_id, actor_id, action, target_user_id, metadata)
  VALUES (
    NEW.class_id,
    _actor,
    CASE WHEN _actor = NEW.student_id THEN 'student_joined' ELSE 'student_enrolled' END,
    NEW.student_id,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_enrollment_removed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip activity logging when the parent class is being deleted (cascade),
  -- otherwise the FK to classes would fail.
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = OLD.class_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.class_activities (class_id, actor_id, action, target_user_id, metadata)
  VALUES (
    OLD.class_id,
    COALESCE(auth.uid(), OLD.student_id),
    'student_removed',
    OLD.student_id,
    '{}'::jsonb
  );
  RETURN OLD;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.log_submission_grade_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'graded' AND (
    NEW.score IS DISTINCT FROM OLD.score OR
    NEW.feedback IS DISTINCT FROM OLD.feedback OR
    NEW.feedback_media_type IS DISTINCT FROM OLD.feedback_media_type OR
    NEW.feedback_media_url IS DISTINCT FROM OLD.feedback_media_url
  ) THEN
    INSERT INTO public.submission_grade_revisions
      (submission_id, score, feedback, feedback_media_type, feedback_media_url, status, revised_by)
    VALUES
      (OLD.id, OLD.score, OLD.feedback, OLD.feedback_media_type, OLD.feedback_media_url, OLD.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.protect_submission_grading()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Server-side auto-grader sets this flag for trusted quiz scoring.
  IF current_setting('app.autograde', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = NEW.assignment_id AND a.teacher_id = auth.uid()
  ) THEN
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.graded_by := OLD.graded_by;
    NEW.graded_at := OLD.graded_at;
    NEW.reward_granted := OLD.reward_granted;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('graded','returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.search_students(_term text)
 RETURNS TABLE(id uuid, full_name text, class_name text, school_id_number text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.class_name, pp.school_id_number
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE _term = ''
     OR p.full_name ILIKE '%' || _term || '%'
     OR COALESCE(pp.school_id_number, '') ILIKE '%' || _term || '%'
  ORDER BY p.full_name
  LIMIT 30;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.shares_class_with(_uid uuid, _other uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- both enrolled as students in the same class
    SELECT 1
    FROM public.class_enrollments e1
    JOIN public.class_enrollments e2 ON e1.class_id = e2.class_id
    WHERE e1.student_id = _uid AND e2.student_id = _other
    UNION
    -- _uid teaches a class _other is enrolled in
    SELECT 1
    FROM public.classes c
    JOIN public.class_enrollments e ON e.class_id = c.id
    WHERE c.teacher_id = _uid AND e.student_id = _other
    UNION
    -- _other teaches a class _uid is enrolled in
    SELECT 1
    FROM public.classes c
    JOIN public.class_enrollments e ON e.class_id = c.id
    WHERE c.teacher_id = _other AND e.student_id = _uid
  )
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

-- ============ TRIGGERS ============
DROP TRIGGER IF EXISTS update_adab_scores_updated_at ON public.adab_scores;
CREATE TRIGGER update_adab_scores_updated_at BEFORE UPDATE ON public.adab_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_announcements_updated_at ON public.announcements;
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_annual_programs_updated ON public.annual_programs;
CREATE TRIGGER trg_annual_programs_updated BEFORE UPDATE ON public.annual_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_answer_keys_updated_at ON public.assignment_answer_keys;
CREATE TRIGGER update_answer_keys_updated_at BEFORE UPDATE ON public.assignment_answer_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_assignments_updated ON public.assignments;
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_attendance_updated ON public.attendance;
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_attendance_settings_updated_at ON public.attendance_settings;
CREATE TRIGGER update_attendance_settings_updated_at BEFORE UPDATE ON public.attendance_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_log_enrollment_added ON public.class_enrollments;
CREATE TRIGGER trg_log_enrollment_added AFTER INSERT ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION log_enrollment_added();
DROP TRIGGER IF EXISTS trg_log_enrollment_removed ON public.class_enrollments;
CREATE TRIGGER trg_log_enrollment_removed AFTER DELETE ON public.class_enrollments FOR EACH ROW EXECUTE FUNCTION log_enrollment_removed();
DROP TRIGGER IF EXISTS trg_classes_updated ON public.classes;
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_log_class_created ON public.classes;
CREATE TRIGGER trg_log_class_created AFTER INSERT ON public.classes FOR EACH ROW EXECUTE FUNCTION log_class_created();
DROP TRIGGER IF EXISTS trg_events_updated ON public.events;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_gcal_updated_at ON public.google_calendar_connections;
CREATE TRIGGER trg_gcal_updated_at BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_journals_updated ON public.journals;
CREATE TRIGGER trg_journals_updated BEFORE UPDATE ON public.journals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_lesson_plans_updated_at ON public.lesson_plans;
CREATE TRIGGER update_lesson_plans_updated_at BEFORE UPDATE ON public.lesson_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_material_reads_updated_at ON public.material_reads;
CREATE TRIGGER update_material_reads_updated_at BEFORE UPDATE ON public.material_reads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_materials_updated ON public.materials;
CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_profile_private_updated_at ON public.profile_private;
CREATE TRIGGER update_profile_private_updated_at BEFORE UPDATE ON public.profile_private FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_qb_updated ON public.question_bank;
CREATE TRIGGER trg_qb_updated BEFORE UPDATE ON public.question_bank FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_semester_programs_updated ON public.semester_programs;
CREATE TRIGGER trg_semester_programs_updated BEFORE UPDATE ON public.semester_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_sheet_sync_state_updated_at ON public.sheet_sync_state;
CREATE TRIGGER update_sheet_sync_state_updated_at BEFORE UPDATE ON public.sheet_sync_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_statuses_updated_at ON public.statuses;
CREATE TRIGGER update_statuses_updated_at BEFORE UPDATE ON public.statuses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS submission_grade_revision_trg ON public.submissions;
CREATE TRIGGER submission_grade_revision_trg BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION log_submission_grade_revision();
DROP TRIGGER IF EXISTS trg_aa_protect_submission ON public.submissions;
CREATE TRIGGER trg_aa_protect_submission BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION protect_submission_grading();
DROP TRIGGER IF EXISTS trg_grant_rewards ON public.submissions;
CREATE TRIGGER trg_grant_rewards BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION grant_submission_rewards();
DROP TRIGGER IF EXISTS trg_submissions_updated ON public.submissions;
CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_mutabaah_updated ON public.tahfidz_mutabaah;
CREATE TRIGGER trg_mutabaah_updated BEFORE UPDATE ON public.tahfidz_mutabaah FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_task_requests_updated_at ON public.task_requests;
CREATE TRIGGER trg_task_requests_updated_at BEFORE UPDATE ON public.task_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_teacher_sheet_sync_updated_at ON public.teacher_sheet_sync;
CREATE TRIGGER update_teacher_sheet_sync_updated_at BEFORE UPDATE ON public.teacher_sheet_sync FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ GRANTS ============
GRANT DELETE, INSERT, SELECT, UPDATE ON public.adab_scores TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.adab_scores TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.adab_scores TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_comments TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_comments TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_comments TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_reactions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_reactions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcement_reactions TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcements TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcements TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.announcements TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.annual_programs TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.annual_programs TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.annual_programs TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.app_settings TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.app_settings TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignment_answer_keys TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignment_answer_keys TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignment_answer_keys TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignments TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignments TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.assignments TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance_settings TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance_settings TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.attendance_settings TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.badges TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.badges TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.badges TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_activities TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_activities TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_activities TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_enrollments TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_enrollments TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.class_enrollments TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.classes TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.classes TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.classes TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.events TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.events TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.events TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.google_calendar_connections TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.google_calendar_connections TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.google_calendar_connections TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.journals TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.journals TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.journals TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.lesson_plans TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.lesson_plans TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.lesson_plans TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.material_reads TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.material_reads TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.material_reads TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.materials TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.materials TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.materials TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.peer_reactions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.peer_reactions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.peer_reactions TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.profile_private TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.profile_private TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.profile_private TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.profiles TO anon;
GRANT DELETE, INSERT, SELECT ON public.profiles TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.profiles TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.question_bank TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.question_bank TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.question_bank TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.semester_programs TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.semester_programs TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.semester_programs TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.sheet_sync_state TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.sheet_sync_state TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.sheet_sync_state TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_comments TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_comments TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_comments TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_reactions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_reactions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.status_reactions TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.statuses TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.statuses TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.statuses TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submission_grade_revisions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submission_grade_revisions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submission_grade_revisions TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submissions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submissions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.submissions TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.tahfidz_mutabaah TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.tahfidz_mutabaah TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.tahfidz_mutabaah TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.task_requests TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.task_requests TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.task_requests TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_calendar_feeds TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_calendar_feeds TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_calendar_feeds TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_invites TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_invites TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_invites TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_sheet_sync TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_sheet_sync TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_sheet_sync TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_subjects TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_subjects TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.teacher_subjects TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_badges TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_badges TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_badges TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_roles TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_roles TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.user_roles TO service_role;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.xp_transactions TO anon;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.xp_transactions TO authenticated;
GRANT DELETE, INSERT, SELECT, UPDATE ON public.xp_transactions TO service_role;

REVOKE ALL ON FUNCTION public.can_view_status(_status_id uuid, _uid uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_teacher_signup_mode() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grade_quiz_submission(_assignment_id uuid, _answers jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_submission_rewards() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.halaqoh_daily_scores(_class_id uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_class_member(_class_id uuid, _user_id uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_class_by_code(_code text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_students() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_class_created() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_enrollment_added() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_enrollment_removed() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_submission_grade_revision() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.protect_submission_grading() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_students(_term text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_class_with(_uid uuid, _other uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_view_status(_status_id uuid, _uid uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_signup_mode() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grade_quiz_submission(_assignment_id uuid, _answers jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_submission_rewards() TO service_role;
GRANT EXECUTE ON FUNCTION public.halaqoh_daily_scores(_class_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_member(_class_id uuid, _user_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(_code text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_class_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_enrollment_added() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_enrollment_removed() TO service_role;
GRANT EXECUTE ON FUNCTION public.log_submission_grade_revision() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_submission_grading() TO service_role;
GRANT EXECUTE ON FUNCTION public.search_students(_term text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shares_class_with(_uid uuid, _other uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- ============ RLS ============
ALTER TABLE public.adab_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semester_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sheet_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_grade_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfidz_mutabaah ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_calendar_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_sheet_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read their own adab scores" ON public.adab_scores;
CREATE POLICY "Students read their own adab scores" ON public.adab_scores AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = student_id));
DROP POLICY IF EXISTS "Teachers manage their adab scores" ON public.adab_scores;
CREATE POLICY "Teachers manage their adab scores" ON public.adab_scores AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role))) WITH CHECK (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role)));
DROP POLICY IF EXISTS "Members insert own announcement comments" ON public.announcement_comments;
CREATE POLICY "Members insert own announcement comments" ON public.announcement_comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_comments.announcement_id) AND is_class_member(a.class_id, auth.uid()))))));
DROP POLICY IF EXISTS "Members view announcement comments" ON public.announcement_comments;
CREATE POLICY "Members view announcement comments" ON public.announcement_comments AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_comments.announcement_id) AND is_class_member(a.class_id, auth.uid())))));
DROP POLICY IF EXISTS "Users or teacher delete announcement comments" ON public.announcement_comments;
CREATE POLICY "Users or teacher delete announcement comments" ON public.announcement_comments AS PERMISSIVE FOR DELETE TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_comments.announcement_id) AND (a.teacher_id = auth.uid()))))));
DROP POLICY IF EXISTS "Members view announcement reactions" ON public.announcement_reactions;
CREATE POLICY "Members view announcement reactions" ON public.announcement_reactions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_reactions.announcement_id) AND is_class_member(a.class_id, auth.uid())))));
DROP POLICY IF EXISTS "Users manage own announcement reaction" ON public.announcement_reactions;
CREATE POLICY "Users manage own announcement reaction" ON public.announcement_reactions AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_reactions.announcement_id) AND is_class_member(a.class_id, auth.uid()))))));
DROP POLICY IF EXISTS "Class members view announcements" ON public.announcements;
CREATE POLICY "Class members view announcements" ON public.announcements AS PERMISSIVE FOR SELECT TO authenticated USING (is_class_member(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teachers manage own announcements" ON public.announcements;
CREATE POLICY "Teachers manage own announcements" ON public.announcements AS PERMISSIVE FOR ALL TO authenticated USING (((teacher_id = auth.uid()) AND is_class_owner(class_id, auth.uid()))) WITH CHECK (((teacher_id = auth.uid()) AND is_class_owner(class_id, auth.uid())));
DROP POLICY IF EXISTS "Teachers manage own annual programs" ON public.annual_programs;
CREATE POLICY "Teachers manage own annual programs" ON public.annual_programs AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Admin reads app settings" ON public.app_settings;
CREATE POLICY "Admin reads app settings" ON public.app_settings AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admin writes app settings" ON public.app_settings;
CREATE POLICY "Admin writes app settings" ON public.app_settings AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Teacher manages answer keys" ON public.assignment_answer_keys;
CREATE POLICY "Teacher manages answer keys" ON public.assignment_answer_keys AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Class members or assigned student view assignments" ON public.assignments;
CREATE POLICY "Class members or assigned student view assignments" ON public.assignments AS PERMISSIVE FOR SELECT TO authenticated USING ((((class_id IS NOT NULL) AND is_class_member(class_id, auth.uid())) OR (assigned_student_id = auth.uid()) OR (teacher_id = auth.uid())));
DROP POLICY IF EXISTS "Teacher manages assignments" ON public.assignments;
CREATE POLICY "Teacher manages assignments" ON public.assignments AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Student views own attendance" ON public.attendance;
CREATE POLICY "Student views own attendance" ON public.attendance AS PERMISSIVE FOR SELECT TO authenticated USING ((student_id = auth.uid()));
DROP POLICY IF EXISTS "Teacher manages attendance" ON public.attendance;
CREATE POLICY "Teacher manages attendance" ON public.attendance AS PERMISSIVE FOR ALL TO authenticated USING (is_class_owner(class_id, auth.uid())) WITH CHECK (is_class_owner(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teachers manage their own attendance settings" ON public.attendance_settings;
CREATE POLICY "Teachers manage their own attendance settings" ON public.attendance_settings AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = teacher_id)) WITH CHECK ((auth.uid() = teacher_id));
DROP POLICY IF EXISTS "All authenticated view badges" ON public.badges;
CREATE POLICY "All authenticated view badges" ON public.badges AS PERMISSIVE FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Teachers delete badges" ON public.badges;
CREATE POLICY "Teachers delete badges" ON public.badges AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Teachers insert badges" ON public.badges;
CREATE POLICY "Teachers insert badges" ON public.badges AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Teachers update badges" ON public.badges;
CREATE POLICY "Teachers update badges" ON public.badges AS PERMISSIVE FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'guru'::app_role)) WITH CHECK (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Class owner can insert activities" ON public.class_activities;
CREATE POLICY "Class owner can insert activities" ON public.class_activities AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((is_class_owner(class_id, auth.uid()) AND (actor_id = auth.uid())));
DROP POLICY IF EXISTS "Members can view class activities" ON public.class_activities;
CREATE POLICY "Members can view class activities" ON public.class_activities AS PERMISSIVE FOR SELECT TO authenticated USING (is_class_member(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teacher enrolls students" ON public.class_enrollments;
CREATE POLICY "Teacher enrolls students" ON public.class_enrollments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_class_owner(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teacher or self remove enrollment" ON public.class_enrollments;
CREATE POLICY "Teacher or self remove enrollment" ON public.class_enrollments AS PERMISSIVE FOR DELETE TO authenticated USING (((student_id = auth.uid()) OR is_class_owner(class_id, auth.uid())));
DROP POLICY IF EXISTS "View own enrollment or as teacher" ON public.class_enrollments;
CREATE POLICY "View own enrollment or as teacher" ON public.class_enrollments AS PERMISSIVE FOR SELECT TO authenticated USING (((student_id = auth.uid()) OR is_class_owner(class_id, auth.uid())));
DROP POLICY IF EXISTS "Members can view class" ON public.classes;
CREATE POLICY "Members can view class" ON public.classes AS PERMISSIVE FOR SELECT TO authenticated USING (((teacher_id = auth.uid()) OR is_class_member(id, auth.uid())));
DROP POLICY IF EXISTS "Teachers manage own classes" ON public.classes;
CREATE POLICY "Teachers manage own classes" ON public.classes AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Class members view events" ON public.events;
CREATE POLICY "Class members view events" ON public.events AS PERMISSIVE FOR SELECT TO authenticated USING (is_class_member(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teacher manages events" ON public.events;
CREATE POLICY "Teacher manages events" ON public.events AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Class members view journals" ON public.journals;
CREATE POLICY "Class members view journals" ON public.journals AS PERMISSIVE FOR SELECT TO authenticated USING (is_class_member(class_id, auth.uid()));
DROP POLICY IF EXISTS "Teacher manages journals" ON public.journals;
CREATE POLICY "Teacher manages journals" ON public.journals AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers manage their own lesson plans" ON public.lesson_plans;
CREATE POLICY "Teachers manage their own lesson plans" ON public.lesson_plans AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = teacher_id)) WITH CHECK ((auth.uid() = teacher_id));
DROP POLICY IF EXISTS "Teachers view reads of their materials" ON public.material_reads;
CREATE POLICY "Teachers view reads of their materials" ON public.material_reads AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM materials m
  WHERE ((m.id = material_reads.material_id) AND (m.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Users manage their own material reads" ON public.material_reads;
CREATE POLICY "Users manage their own material reads" ON public.material_reads AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Class members view materials" ON public.materials;
CREATE POLICY "Class members view materials" ON public.materials AS PERMISSIVE FOR SELECT TO authenticated USING (((teacher_id = auth.uid()) OR ((class_id IS NOT NULL) AND is_class_member(class_id, auth.uid()))));
DROP POLICY IF EXISTS "Teacher manages own materials" ON public.materials;
CREATE POLICY "Teacher manages own materials" ON public.materials AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Class members and staff can read peer reactions" ON public.peer_reactions;
CREATE POLICY "Class members and staff can read peer reactions" ON public.peer_reactions AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = reactor_id) OR (auth.uid() = target_student_id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR shares_class_with(auth.uid(), target_student_id)));
DROP POLICY IF EXISTS "Users add their own reactions" ON public.peer_reactions;
CREATE POLICY "Users add their own reactions" ON public.peer_reactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = reactor_id));
DROP POLICY IF EXISTS "Users remove their own reactions" ON public.peer_reactions;
CREATE POLICY "Users remove their own reactions" ON public.peer_reactions AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = reactor_id));
DROP POLICY IF EXISTS "Owner inserts private profile" ON public.profile_private;
CREATE POLICY "Owner inserts private profile" ON public.profile_private AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Owner or teacher view private profile" ON public.profile_private;
CREATE POLICY "Owner or teacher view private profile" ON public.profile_private AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = id) OR has_role(auth.uid(), 'guru'::app_role)));
DROP POLICY IF EXISTS "Owner updates private profile" ON public.profile_private;
CREATE POLICY "Owner updates private profile" ON public.profile_private AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Class members and staff can view profiles" ON public.profiles;
CREATE POLICY "Class members and staff can view profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR shares_class_with(auth.uid(), id)));
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
DROP POLICY IF EXISTS "Teacher manages own questions" ON public.question_bank;
CREATE POLICY "Teacher manages own questions" ON public.question_bank AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers manage own semester programs" ON public.semester_programs;
CREATE POLICY "Teachers manage own semester programs" ON public.semester_programs AS PERMISSIVE FOR ALL TO authenticated USING ((teacher_id = auth.uid())) WITH CHECK ((teacher_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers view sheet sync state" ON public.sheet_sync_state;
CREATE POLICY "Teachers view sheet sync state" ON public.sheet_sync_state AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Class members and staff can view comments" ON public.status_comments;
CREATE POLICY "Class members and staff can view comments" ON public.status_comments AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = author_id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR can_view_status(status_id, auth.uid())));
DROP POLICY IF EXISTS "Users create own comment" ON public.status_comments;
CREATE POLICY "Users create own comment" ON public.status_comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((author_id = auth.uid()));
DROP POLICY IF EXISTS "Users delete own comment" ON public.status_comments;
CREATE POLICY "Users delete own comment" ON public.status_comments AS PERMISSIVE FOR DELETE TO authenticated USING ((author_id = auth.uid()));
DROP POLICY IF EXISTS "Class members and staff can view status reactions" ON public.status_reactions;
CREATE POLICY "Class members and staff can view status reactions" ON public.status_reactions AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR can_view_status(status_id, auth.uid())));
DROP POLICY IF EXISTS "Users create own reaction" ON public.status_reactions;
CREATE POLICY "Users create own reaction" ON public.status_reactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Users delete own reaction" ON public.status_reactions;
CREATE POLICY "Users delete own reaction" ON public.status_reactions AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
DROP POLICY IF EXISTS "Class members and staff can view statuses" ON public.statuses;
CREATE POLICY "Class members and staff can view statuses" ON public.statuses AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = author_id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR shares_class_with(auth.uid(), author_id)));
DROP POLICY IF EXISTS "Users create own status" ON public.statuses;
CREATE POLICY "Users create own status" ON public.statuses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((author_id = auth.uid()));
DROP POLICY IF EXISTS "Users delete own status" ON public.statuses;
CREATE POLICY "Users delete own status" ON public.statuses AS PERMISSIVE FOR DELETE TO authenticated USING ((author_id = auth.uid()));
DROP POLICY IF EXISTS "Users update own status" ON public.statuses;
CREATE POLICY "Users update own status" ON public.statuses AS PERMISSIVE FOR UPDATE TO authenticated USING ((author_id = auth.uid())) WITH CHECK ((author_id = auth.uid()));
DROP POLICY IF EXISTS "Student can view own revisions" ON public.submission_grade_revisions;
CREATE POLICY "Student can view own revisions" ON public.submission_grade_revisions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM submissions s
  WHERE ((s.id = submission_grade_revisions.submission_id) AND (s.student_id = auth.uid())))));
DROP POLICY IF EXISTS "Teacher owner can insert revisions" ON public.submission_grade_revisions;
CREATE POLICY "Teacher owner can insert revisions" ON public.submission_grade_revisions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((s.id = submission_grade_revisions.submission_id) AND (a.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Teacher owner can view revisions" ON public.submission_grade_revisions;
CREATE POLICY "Teacher owner can view revisions" ON public.submission_grade_revisions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((s.id = submission_grade_revisions.submission_id) AND (a.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Students insert own submission" ON public.submissions;
CREATE POLICY "Students insert own submission" ON public.submissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND ((a.due_at IS NULL) OR (a.due_at > now())))))));
DROP POLICY IF EXISTS "Students update own submission" ON public.submissions;
CREATE POLICY "Students update own submission" ON public.submissions AS PERMISSIVE FOR UPDATE TO authenticated USING ((student_id = auth.uid())) WITH CHECK (((student_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND ((a.due_at IS NULL) OR (a.due_at > now())))))));
DROP POLICY IF EXISTS "Students view own submission" ON public.submissions;
CREATE POLICY "Students view own submission" ON public.submissions AS PERMISSIVE FOR SELECT TO authenticated USING ((student_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers grade submissions" ON public.submissions;
CREATE POLICY "Teachers grade submissions" ON public.submissions AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND (a.teacher_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND (a.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Teachers insert submissions for own assignments" ON public.submissions;
CREATE POLICY "Teachers insert submissions for own assignments" ON public.submissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND (a.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Teachers view submissions" ON public.submissions;
CREATE POLICY "Teachers view submissions" ON public.submissions AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM assignments a
  WHERE ((a.id = submissions.assignment_id) AND (a.teacher_id = auth.uid())))));
DROP POLICY IF EXISTS "Students read own mutabaah" ON public.tahfidz_mutabaah;
CREATE POLICY "Students read own mutabaah" ON public.tahfidz_mutabaah AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = student_id));
DROP POLICY IF EXISTS "Teachers manage own mutabaah" ON public.tahfidz_mutabaah;
CREATE POLICY "Teachers manage own mutabaah" ON public.tahfidz_mutabaah AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role))) WITH CHECK (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role)));
DROP POLICY IF EXISTS "Students delete own pending" ON public.task_requests;
CREATE POLICY "Students delete own pending" ON public.task_requests AS PERMISSIVE FOR DELETE TO authenticated USING (((student_id = auth.uid()) AND (status = 'pending'::task_request_status)));
DROP POLICY IF EXISTS "Students insert own request" ON public.task_requests;
CREATE POLICY "Students insert own request" ON public.task_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((student_id = auth.uid()));
DROP POLICY IF EXISTS "Students update own pending" ON public.task_requests;
CREATE POLICY "Students update own pending" ON public.task_requests AS PERMISSIVE FOR UPDATE TO authenticated USING (((student_id = auth.uid()) AND (status = 'pending'::task_request_status))) WITH CHECK ((student_id = auth.uid()));
DROP POLICY IF EXISTS "Students view own requests" ON public.task_requests;
CREATE POLICY "Students view own requests" ON public.task_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((student_id = auth.uid()));
DROP POLICY IF EXISTS "Teachers respond directed" ON public.task_requests;
CREATE POLICY "Teachers respond directed" ON public.task_requests AS PERMISSIVE FOR UPDATE TO authenticated USING (((teacher_id = auth.uid()) OR ((class_id IS NOT NULL) AND is_class_owner(class_id, auth.uid())))) WITH CHECK (((teacher_id = auth.uid()) OR ((class_id IS NOT NULL) AND is_class_owner(class_id, auth.uid()))));
DROP POLICY IF EXISTS "Teachers view directed" ON public.task_requests;
CREATE POLICY "Teachers view directed" ON public.task_requests AS PERMISSIVE FOR SELECT TO authenticated USING (((teacher_id = auth.uid()) OR ((class_id IS NOT NULL) AND is_class_owner(class_id, auth.uid()))));
DROP POLICY IF EXISTS "Teachers manage own feed" ON public.teacher_calendar_feeds;
CREATE POLICY "Teachers manage own feed" ON public.teacher_calendar_feeds AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
DROP POLICY IF EXISTS "Admins can view invites" ON public.teacher_invites;
CREATE POLICY "Admins can view invites" ON public.teacher_invites AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Teachers read own sheet sync" ON public.teacher_sheet_sync;
CREATE POLICY "Teachers read own sheet sync" ON public.teacher_sheet_sync AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = teacher_id));
DROP POLICY IF EXISTS "Students read subjects of their class teachers" ON public.teacher_subjects;
CREATE POLICY "Students read subjects of their class teachers" ON public.teacher_subjects AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (class_enrollments ce
     JOIN classes c ON ((c.id = ce.class_id)))
  WHERE ((ce.student_id = auth.uid()) AND (c.teacher_id = teacher_subjects.teacher_id)))));
DROP POLICY IF EXISTS "Teachers manage own subjects" ON public.teacher_subjects;
CREATE POLICY "Teachers manage own subjects" ON public.teacher_subjects AS PERMISSIVE FOR ALL TO authenticated USING (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role))) WITH CHECK (((auth.uid() = teacher_id) AND has_role(auth.uid(), 'guru'::app_role)));
DROP POLICY IF EXISTS "Class members and staff can view user_badges" ON public.user_badges;
CREATE POLICY "Class members and staff can view user_badges" ON public.user_badges AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'guru'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR shares_class_with(auth.uid(), user_id)));
DROP POLICY IF EXISTS "Teachers award badges" ON public.user_badges;
CREATE POLICY "Teachers award badges" ON public.user_badges AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Teachers revoke badges" ON public.user_badges;
CREATE POLICY "Teachers revoke badges" ON public.user_badges AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'guru'::app_role));
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));
DROP POLICY IF EXISTS "User views own xp tx" ON public.xp_transactions;
CREATE POLICY "User views own xp tx" ON public.xp_transactions AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- ============ TRIGGER PEMBUATAN PROFIL OTOMATIS (auth.users) ============
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ATURAN AKSES FILE (storage.objects) ============
-- Jalankan setelah 3 bucket dibuat. Bila bucket belum ada, blok ini tetap aman.
DROP POLICY IF EXISTS "Students upload own voice answers" ON storage.objects;
CREATE POLICY "Students upload own voice answers" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'voice-answers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Students update own voice answers" ON storage.objects;
CREATE POLICY "Students update own voice answers" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'voice-answers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Students delete own voice answers" ON storage.objects;
CREATE POLICY "Students delete own voice answers" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'voice-answers'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Owners upload lesson media" ON storage.objects;
CREATE POLICY "Owners upload lesson media" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'lesson-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Owners update lesson media" ON storage.objects;
CREATE POLICY "Owners update lesson media" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'lesson-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) WITH CHECK (((bucket_id = 'lesson-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Owners delete lesson media" ON storage.objects;
CREATE POLICY "Owners delete lesson media" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'lesson-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Owner or teacher read voice answers" ON storage.objects;
CREATE POLICY "Owner or teacher read voice answers" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'voice-answers'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((s.file_url = objects.name) AND (a.teacher_id = auth.uid())))))));
DROP POLICY IF EXISTS "Students upload own answer images" ON storage.objects;
CREATE POLICY "Students upload own answer images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'answer-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Students update own answer images" ON storage.objects;
CREATE POLICY "Students update own answer images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'answer-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Students delete own answer images" ON storage.objects;
CREATE POLICY "Students delete own answer images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'answer-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
DROP POLICY IF EXISTS "Owner or teacher read answer images" ON storage.objects;
CREATE POLICY "Owner or teacher read answer images" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'answer-images'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM (submissions s
     JOIN assignments a ON ((a.id = s.assignment_id)))
  WHERE ((s.file_url = objects.name) AND (a.teacher_id = auth.uid())))))));
DROP POLICY IF EXISTS "Class-scoped read lesson media" ON storage.objects;
CREATE POLICY "Class-scoped read lesson media" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'lesson-media'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR (EXISTS ( SELECT 1
   FROM materials m
  WHERE (((m.media_url = objects.name) OR (m.file_url = objects.name)) AND ((m.teacher_id = auth.uid()) OR ((m.class_id IS NOT NULL) AND is_class_member(m.class_id, auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM assignments a
  WHERE (((a.teacher_id = auth.uid()) OR (a.assigned_student_id = auth.uid()) OR ((a.class_id IS NOT NULL) AND is_class_member(a.class_id, auth.uid()))) AND ((a.attachment_url = objects.name) OR ((jsonb_typeof(a.questions) = 'array'::text) AND (EXISTS ( SELECT 1
           FROM jsonb_array_elements(a.questions) q(value)
          WHERE ((q.value ->> 'image_url'::text) = objects.name)))))))) OR (EXISTS ( SELECT 1
   FROM submissions s
  WHERE ((s.feedback_media_url = objects.name) AND ((s.student_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM assignments a2
          WHERE ((a2.id = s.assignment_id) AND (a2.teacher_id = auth.uid())))))))))));


-- ============ DEFAULT PRIVILEGES ============
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- SELESAI. Bila muncul "Success", skema siap dipakai.
