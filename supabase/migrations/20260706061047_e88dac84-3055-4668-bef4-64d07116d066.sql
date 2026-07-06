CREATE OR REPLACE FUNCTION public.grade_quiz_submission(_assignment_id uuid, _answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _a public.assignments;
  _key jsonb;
  _total int;
  _auto_correct int := 0;
  _manual_pending int := 0;
  _points numeric := 0;
  _per numeric;
  _score int;
  _status submission_status;
  _i int;
  _type text;
  _stud text;
  _accepted text;
  _ok boolean;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'siswa') THEN RAISE EXCEPTION 'NOT_A_STUDENT'; END IF;

  SELECT * INTO _a FROM public.assignments WHERE id = _assignment_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;

  IF _a.assigned_student_id IS NOT NULL THEN
    IF _a.assigned_student_id <> _uid THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  ELSIF _a.class_id IS NOT NULL THEN
    IF NOT public.is_class_member(_a.class_id, _uid) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.submissions WHERE assignment_id = _assignment_id AND student_id = _uid) THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED';
  END IF;

  SELECT answer_key::jsonb INTO _key FROM public.assignment_answer_keys WHERE assignment_id = _assignment_id;
  IF _key IS NULL THEN RAISE EXCEPTION 'NO_ANSWER_KEY'; END IF;

  _total := jsonb_array_length(_a.questions);
  IF _total IS NULL OR _total = 0 THEN RAISE EXCEPTION 'NO_QUESTIONS'; END IF;
  _per := _a.max_score::numeric / _total;

  FOR _i IN 0.._total - 1 LOOP
    _type := COALESCE(_a.questions -> _i ->> 'type', 'multiple_choice');

    IF _type IN ('essay', 'voice', 'image') THEN
      _manual_pending := _manual_pending + 1;
      CONTINUE;
    END IF;

    _stud := _answers ->> _i;
    _ok := false;

    IF _stud IS NOT NULL AND btrim(_stud) <> '' THEN
      IF _type = 'short_answer' THEN
        FOREACH _accepted IN ARRAY string_to_array(COALESCE(_key ->> _i, ''), '|') LOOP
          IF lower(btrim(_stud)) = lower(btrim(_accepted)) AND btrim(_accepted) <> '' THEN
            _ok := true;
          END IF;
        END LOOP;
      ELSE
        IF lower(btrim(_stud)) = lower(btrim(COALESCE(_key ->> _i, ''))) THEN
          _ok := true;
        END IF;
      END IF;
    END IF;

    IF _ok THEN
      _auto_correct := _auto_correct + 1;
      _points := _points + _per;
    END IF;
  END LOOP;

  _score := round(_points);
  _status := CASE WHEN _manual_pending > 0 THEN 'submitted'::submission_status ELSE 'graded'::submission_status END;

  PERFORM set_config('app.autograde', '1', true);

  INSERT INTO public.submissions (assignment_id, student_id, content, status, score, submitted_at)
  VALUES (_assignment_id, _uid, _answers::text, _status, _score, now());

  IF _manual_pending = 0 THEN
    UPDATE public.submissions
      SET graded_by = _a.teacher_id, graded_at = now()
      WHERE assignment_id = _assignment_id AND student_id = _uid;
  END IF;

  RETURN jsonb_build_object(
    'auto_correct', _auto_correct,
    'total', _total,
    'manual_pending', _manual_pending,
    'score', _score,
    'max_score', _a.max_score,
    'status', _status
  );
END;
$function$;