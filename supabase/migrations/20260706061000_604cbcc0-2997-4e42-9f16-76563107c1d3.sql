-- 1. Allow 'image' as a bank-soal / quiz question type (student uploads a photo answer)
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'image';

-- 2. Storage policies for the private answer-images bucket (student photo answers)
CREATE POLICY "Students upload own answer images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'answer-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Students update own answer images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'answer-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Students delete own answer images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'answer-images' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owner or teacher read answer images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'answer-images'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR EXISTS (
        SELECT 1 FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.file_url = objects.name AND a.teacher_id = auth.uid()
      )
    )
  );