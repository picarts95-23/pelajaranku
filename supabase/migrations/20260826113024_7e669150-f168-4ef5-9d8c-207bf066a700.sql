DROP POLICY "Teachers manage own announcements" ON public.announcements;
CREATE POLICY "Teachers manage own announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND is_class_owner(class_id, auth.uid()))
  WITH CHECK (teacher_id = auth.uid() AND is_class_owner(class_id, auth.uid()));