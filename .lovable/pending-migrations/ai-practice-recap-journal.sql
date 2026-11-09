CREATE TABLE public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic text NOT NULL,
  level text NOT NULL CHECK (level IN ('dasar', 'menengah', 'mahir')),
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  correct_count integer NOT NULL CHECK (correct_count >= 0),
  question_count integer NOT NULL CHECK (question_count BETWEEN 1 AND 20),
  hints_used integer NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  weak_concepts text[] NOT NULL DEFAULT '{}',
  feedback text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, client_id)
);
GRANT SELECT ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own AI practice" ON public.practice_attempts
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Teachers read class AI practice" ON public.practice_attempts
  FOR SELECT TO authenticated USING (public.is_class_owner(class_id, auth.uid()));

CREATE POLICY "Students read teacher grade weights" ON public.grade_weights
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.class_enrollments e ON e.class_id = c.id
      WHERE c.teacher_id = grade_weights.teacher_id AND e.student_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.record_ai_practice_journal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  SELECT teacher_id INTO v_teacher_id FROM public.classes WHERE id = NEW.class_id;
  IF v_teacher_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.journals (class_id, teacher_id, student_id, subject, date, topic, notes)
  VALUES (
    NEW.class_id,
    v_teacher_id,
    NEW.student_id,
    NEW.subject,
    (NEW.created_at AT TIME ZONE 'Asia/Jakarta')::date,
    'Latihan AI · ' || NEW.topic,
    NEW.feedback || E'\n\nNilai tambahan Latihan AI: ' || NEW.score || '/100 (' || NEW.correct_count || '/' || NEW.question_count || ' benar).'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_practice_journal
AFTER INSERT ON public.practice_attempts
FOR EACH ROW EXECUTE FUNCTION public.record_ai_practice_journal();
