-- Add subject and student linkage to journals so entries sync with class students
ALTER TABLE public.journals
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Allow voice (audio) answer questions in the question bank
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'voice';