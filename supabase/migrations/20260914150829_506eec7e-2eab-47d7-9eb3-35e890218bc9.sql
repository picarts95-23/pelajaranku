ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS interactive_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_time_limit integer;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_question_time_limit_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_question_time_limit_check
  CHECK (question_time_limit IS NULL OR question_time_limit BETWEEN 10 AND 300);