-- Classify Bank Soal questions into exam categories.
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS exam_category text NOT NULL DEFAULT 'harian';

-- Backfill: any existing Halaqoh question becomes the 'halaqoh' category.
UPDATE public.question_bank
  SET exam_category = 'halaqoh'
  WHERE halaqoh_kind IS NOT NULL AND exam_category = 'harian';

-- Keep values constrained to the four supported categories.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'question_bank_exam_category_check'
  ) THEN
    ALTER TABLE public.question_bank
      ADD CONSTRAINT question_bank_exam_category_check
      CHECK (exam_category IN ('harian', 'uts', 'uas', 'halaqoh'));
  END IF;
END $$;