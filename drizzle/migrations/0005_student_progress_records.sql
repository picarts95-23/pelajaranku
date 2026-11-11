CREATE TABLE public.student_progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  objective_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  development_notes text,
  report_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, student_id, class_id, subject)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_progress_records TO authenticated;
GRANT ALL ON public.student_progress_records TO service_role;
ALTER TABLE public.student_progress_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own student progress records" ON public.student_progress_records
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.is_class_owner(class_id, auth.uid()))
  WITH CHECK (teacher_id = auth.uid() AND public.is_class_owner(class_id, auth.uid()));
CREATE POLICY "Students read own progress records" ON public.student_progress_records
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND public.is_class_member(class_id, auth.uid()));
CREATE TRIGGER trg_student_progress_records_updated BEFORE UPDATE ON public.student_progress_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();