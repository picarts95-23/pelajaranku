-- Multi-question quiz support (up to 40 multiple-choice questions per quiz)
-- Questions (prompt + options, WITHOUT the correct answer) live on assignments.questions.
-- Correct answers stay hidden in assignment_answer_keys (students can never read them).

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS questions jsonb;

-- Allow the auto-grader to bypass the student grading lock for quiz submissions.
CREATE OR REPLACE FUNCTION public.protect_submission_grading()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Server-side auto-grader sets this flag for trusted quiz scoring.
  IF current_setting('app.autograde', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = NEW.assignment_id AND a.teacher_id = auth.uid()
  ) THEN
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.graded_by := OLD.graded_by;
    NEW.graded_at := OLD.graded_at;
    NEW.reward_granted := OLD.reward_granted;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('graded','returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Auto-grade a multiple-choice quiz for the calling student.
-- _answers: jsonb array of chosen option indexes, e.g. [0,2,1,3]
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
  _correct int := 0;
  _score int;
  _i int;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_uid, 'siswa') THEN RAISE EXCEPTION 'NOT_A_STUDENT'; END IF;

  SELECT * INTO _a FROM public.assignments WHERE id = _assignment_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND'; END IF;

  -- Access: directly assigned to this student, or enrolled in the target class.
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
    IF (_answers -> _i) IS NOT NULL
       AND (_answers ->> _i) = (_key ->> _i) THEN
      _correct := _correct + 1;
    END IF;
  END LOOP;

  _score := round((_correct::numeric / _total) * _a.max_score);

  PERFORM set_config('app.autograde', '1', true);

  INSERT INTO public.submissions (assignment_id, student_id, content, status, score, submitted_at)
  VALUES (_assignment_id, _uid, _answers::text, 'submitted', _score, now());

  -- Triggering grant_submission_rewards (BEFORE UPDATE) to award XP/coins.
  UPDATE public.submissions
    SET status = 'graded', graded_by = _a.teacher_id, graded_at = now()
    WHERE assignment_id = _assignment_id AND student_id = _uid;

  RETURN jsonb_build_object('correct', _correct, 'total', _total, 'score', _score, 'max_score', _a.max_score);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.grade_quiz_submission(uuid, jsonb) TO authenticated;