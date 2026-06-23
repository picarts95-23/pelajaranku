-- 1. Restrict attendance_settings policy to authenticated role explicitly
DROP POLICY IF EXISTS "Teachers manage their own attendance settings" ON public.attendance_settings;
CREATE POLICY "Teachers manage their own attendance settings"
ON public.attendance_settings
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

-- 2. Allow students to read teacher subjects for teachers of classes they are enrolled in
CREATE POLICY "Students read subjects of their class teachers"
ON public.teacher_subjects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.class_enrollments ce
    JOIN public.classes c ON c.id = ce.class_id
    WHERE ce.student_id = auth.uid()
      AND c.teacher_id = teacher_subjects.teacher_id
  )
);