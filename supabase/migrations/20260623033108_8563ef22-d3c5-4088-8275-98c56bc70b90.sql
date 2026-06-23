-- Read: any signed-in user can view lesson media (shared school content)
CREATE POLICY "Signed-in users read lesson media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-media');

-- Write: owner can manage files inside their own folder (folder name = user id)
CREATE POLICY "Owners upload lesson media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update lesson media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete lesson media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);