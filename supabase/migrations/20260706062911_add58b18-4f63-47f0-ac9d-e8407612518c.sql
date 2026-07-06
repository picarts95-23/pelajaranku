-- Tighten lesson-media SELECT so signed-in users can only read files they are
-- entitled to: teacher owner, class members of a material referencing the file,
-- or users who can access an assignment whose questions reference the image.
DROP POLICY IF EXISTS "Signed-in users read lesson media" ON storage.objects;

CREATE POLICY "Class-scoped read lesson media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'lesson-media' AND (
    -- Teacher/owner: files are stored under their own uid folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Material referencing this file, scoped to class membership / ownership
    EXISTS (
      SELECT 1 FROM public.materials m
      WHERE (m.media_url = storage.objects.name OR m.file_url = storage.objects.name)
        AND (
          m.teacher_id = auth.uid()
          OR (m.class_id IS NOT NULL AND public.is_class_member(m.class_id, auth.uid()))
        )
    )
    OR
    -- Question image inside an assignment the user can access
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE (
          a.teacher_id = auth.uid()
          OR a.assigned_student_id = auth.uid()
          OR (a.class_id IS NOT NULL AND public.is_class_member(a.class_id, auth.uid()))
        )
        AND jsonb_typeof(a.questions) = 'array'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(a.questions) q
          WHERE q->>'image_url' = storage.objects.name
        )
    )
  )
);