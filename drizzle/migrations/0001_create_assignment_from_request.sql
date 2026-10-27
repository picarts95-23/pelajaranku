CREATE OR REPLACE FUNCTION public.create_assignment_from_request(_request_id uuid, _assignment jsonb, _answer_key text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r public.task_requests%ROWTYPE; a public.assignments%ROWTYPE; new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'guru') THEN RAISE EXCEPTION 'Hanya guru yang dapat membuat tugas'; END IF;
  SELECT * INTO r FROM public.task_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permintaan tidak ditemukan'; END IF;
  IF NOT (r.teacher_id = auth.uid() OR (r.class_id IS NOT NULL AND public.is_class_owner(r.class_id, auth.uid()))) THEN RAISE EXCEPTION 'Permintaan bukan untuk Anda'; END IF;
  IF r.assignment_id IS NOT NULL THEN RETURN r.assignment_id; END IF;
  IF r.status NOT IN ('pending', 'accepted', 'converted') THEN RAISE EXCEPTION 'Permintaan tidak dapat dijadikan tugas'; END IF;
  a := jsonb_populate_record(NULL::public.assignments, _assignment);
  IF nullif(trim(a.title), '') IS NULL THEN RAISE EXCEPTION 'Judul tugas wajib diisi'; END IF;
  IF a.due_at IS NULL THEN RAISE EXCEPTION 'Tenggat tugas wajib diisi'; END IF;
  IF a.assigned_student_id IS NOT NULL THEN
    IF a.assigned_student_id <> r.student_id THEN RAISE EXCEPTION 'Siswa harus sesuai permintaan'; END IF;
  ELSIF a.class_id IS NULL OR a.class_id IS DISTINCT FROM r.class_id OR NOT public.is_class_owner(a.class_id, auth.uid()) THEN
    RAISE EXCEPTION 'Kelas harus sesuai permintaan';
  END IF;
  INSERT INTO public.assignments (teacher_id, class_id, assigned_student_id, title, description, subject, exam_type, halaqoh_kind, due_at, max_score, xp_reward, coin_reward, quiz_link, game_link, answer_format, options, muroja_juz, muroja_surah, muroja_ayat, attachment_url, attachment_name, attachment_type)
  VALUES (auth.uid(), CASE WHEN a.assigned_student_id IS NULL THEN a.class_id ELSE NULL END, a.assigned_student_id, trim(a.title), a.description, a.subject, coalesce(a.exam_type, 'harian'), a.halaqoh_kind, a.due_at, coalesce(a.max_score,100), coalesce(a.xp_reward,50), coalesce(a.coin_reward,10), a.quiz_link, a.game_link, coalesce(a.answer_format,'descriptive'), a.options, a.muroja_juz, a.muroja_surah, a.muroja_ayat, a.attachment_url, a.attachment_name, a.attachment_type) RETURNING id INTO new_id;
  IF nullif(trim(_answer_key), '') IS NOT NULL THEN
    INSERT INTO public.assignment_answer_keys (assignment_id, teacher_id, answer_key) VALUES (new_id, auth.uid(), trim(_answer_key));
  END IF;
  UPDATE public.task_requests SET status = 'converted', assignment_id = new_id, responded_at = now() WHERE id = r.id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_assignment_from_request(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_assignment_from_request(uuid, jsonb, text) TO authenticated;