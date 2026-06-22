ALTER TABLE public.assignments ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assigned_student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_target_check
  CHECK (class_id IS NOT NULL OR assigned_student_id IS NOT NULL);

DROP POLICY IF EXISTS "Class members view assignments" ON public.assignments;

CREATE POLICY "Class members or assigned student view assignments"
  ON public.assignments FOR SELECT
  TO authenticated
  USING (
    (class_id IS NOT NULL AND public.is_class_member(class_id, auth.uid()))
    OR assigned_student_id = auth.uid()
    OR teacher_id = auth.uid()
  );