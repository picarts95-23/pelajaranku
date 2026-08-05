ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

DROP POLICY IF EXISTS "Class-scoped read lesson media" ON storage.objects;
CREATE POLICY "Class-scoped read lesson media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lesson-media' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.materials m
      WHERE (m.media_url = objects.name OR m.file_url = objects.name)
        AND (m.teacher_id = auth.uid()
             OR (m.class_id IS NOT NULL AND public.is_class_member(m.class_id, auth.uid())))
    )
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE (a.teacher_id = auth.uid()
             OR a.assigned_student_id = auth.uid()
             OR (a.class_id IS NOT NULL AND public.is_class_member(a.class_id, auth.uid())))
        AND (
          a.attachment_url = objects.name
          OR (
            jsonb_typeof(a.questions) = 'array'
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements(a.questions) q(value)
              WHERE (q.value ->> 'image_url') = objects.name
            )
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.feedback_media_url = objects.name
        AND (s.student_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.assignments a2
                        WHERE a2.id = s.assignment_id AND a2.teacher_id = auth.uid()))
    )
  )
);