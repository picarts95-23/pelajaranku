-- 1. Multimedia support for materials
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_url text;

-- 2. Image support for question bank
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS image_url text;

-- 3. Exam type tag for assignments (used by grade recap)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'harian'
    CHECK (exam_type IN ('harian', 'uts', 'uas'));

-- 4. Adab (manners) scores entered by teachers for the grade recap
CREATE TABLE IF NOT EXISTS public.adab_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, class_id, subject)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adab_scores TO authenticated;
GRANT ALL ON public.adab_scores TO service_role;

ALTER TABLE public.adab_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their adab scores"
  ON public.adab_scores FOR ALL TO authenticated
  USING (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'))
  WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Students read their own adab scores"
  ON public.adab_scores FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE TRIGGER update_adab_scores_updated_at
  BEFORE UPDATE ON public.adab_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Peer emoji reactions on the leaderboard
CREATE TABLE IF NOT EXISTS public.peer_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reactor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_student_id, reactor_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.peer_reactions TO authenticated;
GRANT ALL ON public.peer_reactions TO service_role;

ALTER TABLE public.peer_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read reactions"
  ON public.peer_reactions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users add their own reactions"
  ON public.peer_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reactor_id);

CREATE POLICY "Users remove their own reactions"
  ON public.peer_reactions FOR DELETE TO authenticated
  USING (auth.uid() = reactor_id);