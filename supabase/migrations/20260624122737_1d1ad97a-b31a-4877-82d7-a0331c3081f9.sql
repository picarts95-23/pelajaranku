-- Add grade/jenjang target and Halaqoh-specific kind to question bank
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS grade_level text,
  ADD COLUMN IF NOT EXISTS halaqoh_kind text;

-- Allow short-answer (isian singkat) questions in the bank
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'short_answer';

COMMENT ON COLUMN public.question_bank.grade_level IS 'Target kelas/jenjang for the question (free text, e.g. "Kelas 7" or "SMP").';
COMMENT ON COLUMN public.question_bank.halaqoh_kind IS 'Halaqoh Quran kind: menyimak | setoran | tilawah. NULL for regular questions.';