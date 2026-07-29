CREATE POLICY "Teachers insert submissions for own assignments"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignments a
  WHERE a.id = submissions.assignment_id AND a.teacher_id = auth.uid()
));