ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}';

-- Backfill: copy any existing single subject into the new array.
UPDATE public.classes
SET subjects = ARRAY[subject]
WHERE subject IS NOT NULL AND subject <> '' AND (subjects IS NULL OR array_length(subjects, 1) IS NULL);