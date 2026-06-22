-- 1. Assignment answer format + muroja (Quran memorization) fields
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS answer_format text NOT NULL DEFAULT 'descriptive',
  ADD COLUMN IF NOT EXISTS options jsonb,
  ADD COLUMN IF NOT EXISTS muroja_juz text,
  ADD COLUMN IF NOT EXISTS muroja_surah text,
  ADD COLUMN IF NOT EXISTS muroja_ayat text;

-- 2. Answer keys stored separately so students can NEVER read them
CREATE TABLE IF NOT EXISTS public.assignment_answer_keys (
  assignment_id uuid PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  answer_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_answer_keys TO authenticated;
GRANT ALL ON public.assignment_answer_keys TO service_role;

ALTER TABLE public.assignment_answer_keys ENABLE ROW LEVEL SECURITY;

-- Only the owning teacher can read/write the answer key. Students have no access at all.
CREATE POLICY "Teacher manages answer keys"
  ON public.assignment_answer_keys FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_answer_keys_updated_at
  BEFORE UPDATE ON public.assignment_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Storage policies for the private "voice-answers" bucket.
-- Files are stored under "<student_id>/<file>". Students manage their own folder.
CREATE POLICY "Students upload own voice answers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'voice-answers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students update own voice answers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'voice-answers' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students delete own voice answers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'voice-answers' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Any authenticated user (e.g. the grading teacher) can read voice answers to listen.
CREATE POLICY "Authenticated read voice answers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'voice-answers');