ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS stimulus text,
  ADD COLUMN IF NOT EXISTS points numeric,
  ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
  ADD COLUMN IF NOT EXISTS indicator text;

ALTER TABLE public.question_bank
  DROP CONSTRAINT IF EXISTS question_bank_points_check,
  ADD CONSTRAINT question_bank_points_check CHECK (points IS NULL OR (points > 0 AND points <= 1000)),
  DROP CONSTRAINT IF EXISTS question_bank_time_limit_seconds_check,
  ADD CONSTRAINT question_bank_time_limit_seconds_check CHECK (time_limit_seconds IS NULL OR (time_limit_seconds >= 10 AND time_limit_seconds <= 600));

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;

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
  _earned_weight numeric := 0;
  _total_weight numeric := 0;
  _question_weight numeric;
  _score int;
  _status submission_status;
  _i int;
  _type text;
  _stud text;
  _accepted text;
  _ok boolean;
  _indicator text;
  _breakdown jsonb := '{}'::jsonb;
  _bucket jsonb;
  _breakdown_array jsonb;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'siswa') THEN RAISE EXCEPTION 'NOT_A_STUDENT'; END IF;

  SELECT * INTO _a FROM public.assignments WHERE id = _assignment_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;
  IF _a.due_at IS NOT NULL AND _a.due_at <= now() THEN RAISE EXCEPTION 'DEADLINE_PASSED'; END IF;

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

  FOR _i IN 0.._total - 1 LOOP
    _question_weight := COALESCE(NULLIF(_a.questions -> _i ->> 'points', '')::numeric, 1);
    IF _question_weight <= 0 THEN _question_weight := 1; END IF;
    _total_weight := _total_weight + _question_weight;
  END LOOP;

  FOR _i IN 0.._total - 1 LOOP
    _type := COALESCE(_a.questions -> _i ->> 'type', 'multiple_choice');
    _question_weight := COALESCE(NULLIF(_a.questions -> _i ->> 'points', '')::numeric, 1);
    IF _question_weight <= 0 THEN _question_weight := 1; END IF;
    _indicator := COALESCE(NULLIF(btrim(_a.questions -> _i ->> 'indicator'), ''), 'Umum');
    _bucket := COALESCE(_breakdown -> _indicator, jsonb_build_object('indicator', _indicator, 'correct', 0, 'total', 0, 'earned_points', 0, 'max_points', 0, 'manual_pending', 0));
    _bucket := jsonb_set(_bucket, '{total}', to_jsonb(COALESCE((_bucket ->> 'total')::int, 0) + 1));
    _bucket := jsonb_set(_bucket, '{max_points}', to_jsonb(COALESCE((_bucket ->> 'max_points')::numeric, 0) + _question_weight));

    IF _type IN ('essay', 'voice', 'image') THEN
      _manual_pending := _manual_pending + 1;
      _bucket := jsonb_set(_bucket, '{manual_pending}', to_jsonb(COALESCE((_bucket ->> 'manual_pending')::int, 0) + 1));
      _breakdown := jsonb_set(_breakdown, ARRAY[_indicator], _bucket, true);
      CONTINUE;
    END IF;

    _stud := _answers ->> _i;
    _ok := false;
    IF _stud IS NOT NULL AND btrim(_stud) <> '' THEN
      IF _type = 'short_answer' THEN
        FOREACH _accepted IN ARRAY string_to_array(COALESCE(_key ->> _i, ''), '|') LOOP
          IF lower(btrim(_stud)) = lower(btrim(_accepted)) AND btrim(_accepted) <> '' THEN _ok := true; END IF;
        END LOOP;
      ELSE
        IF lower(btrim(_stud)) = lower(btrim(COALESCE(_key ->> _i, ''))) THEN _ok := true; END IF;
      END IF;
    END IF;

    IF _ok THEN
      _auto_correct := _auto_correct + 1;
      _earned_weight := _earned_weight + _question_weight;
      _bucket := jsonb_set(_bucket, '{correct}', to_jsonb(COALESCE((_bucket ->> 'correct')::int, 0) + 1));
      _bucket := jsonb_set(_bucket, '{earned_points}', to_jsonb(COALESCE((_bucket ->> 'earned_points')::numeric, 0) + _question_weight));
    END IF;
    _breakdown := jsonb_set(_breakdown, ARRAY[_indicator], _bucket, true);
  END LOOP;

  SELECT COALESCE(jsonb_agg(value ORDER BY key), '[]'::jsonb) INTO _breakdown_array FROM jsonb_each(_breakdown);
  _score := CASE WHEN _total_weight > 0 THEN round((_earned_weight / _total_weight) * _a.max_score) ELSE 0 END;
  _status := CASE WHEN _manual_pending > 0 THEN 'submitted'::submission_status ELSE 'graded'::submission_status END;

  PERFORM set_config('app.autograde', '1', true);
  INSERT INTO public.submissions (assignment_id, student_id, content, status, score, score_breakdown, submitted_at)
  VALUES (_assignment_id, _uid, _answers::text, _status, _score, _breakdown_array, now());

  IF _manual_pending = 0 THEN
    UPDATE public.submissions SET graded_by = _a.teacher_id, graded_at = now()
    WHERE assignment_id = _assignment_id AND student_id = _uid;
  END IF;

  RETURN jsonb_build_object(
    'auto_correct', _auto_correct,
    'total', _total,
    'manual_pending', _manual_pending,
    'score', _score,
    'max_score', _a.max_score,
    'status', _status,
    'breakdown', _breakdown_array
  );
END;
$function$;