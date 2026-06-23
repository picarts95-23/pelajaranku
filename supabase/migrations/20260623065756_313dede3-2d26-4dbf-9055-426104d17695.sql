-- 1) class_enrollments: remove direct self-enroll. Students join only via join_class_by_code RPC.
DROP POLICY IF EXISTS "Students self enroll" ON public.class_enrollments;

-- 2) google_calendar_connections: remove client-readable SELECT policy.
-- OAuth tokens must only be accessed server-side via the service role.
DROP POLICY IF EXISTS "Users view own calendar connection" ON public.google_calendar_connections;

-- 3) submissions: students may no longer change grading fields via the ALL policy.
DROP POLICY IF EXISTS "Students manage own submission" ON public.submissions;

CREATE POLICY "Students view own submission"
  ON public.submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students insert own submission"
  ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Students may update their own submission (e.g. resubmit) but grading fields
-- are protected by the trigger below.
CREATE POLICY "Students update own submission"
  ON public.submissions FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Trigger: when the updater is not the assignment's teacher, preserve all
-- grading-controlled fields so students cannot self-grade or alter rewards.
CREATE OR REPLACE FUNCTION public.protect_submission_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = NEW.assignment_id AND a.teacher_id = auth.uid()
  ) THEN
    -- Non-teacher (student) update: lock grading fields to previous values.
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.graded_by := OLD.graded_by;
    NEW.graded_at := OLD.graded_at;
    NEW.reward_granted := OLD.reward_granted;
    -- Students cannot move a submission into graded/returned states.
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('graded','returned') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_submission_grading() FROM PUBLIC, anon, authenticated;

-- Run before reward-granting so a student cannot trigger rewards by faking 'graded'.
DROP TRIGGER IF EXISTS trg_aa_protect_submission ON public.submissions;
CREATE TRIGGER trg_aa_protect_submission
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_submission_grading();