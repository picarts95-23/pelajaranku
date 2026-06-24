-- Item 3: Mutaba'ah / Halaqoh setoran classification on the question bank and
-- the Mutaba'ah records, plus daily-tilawah page tracking.

-- Setoran kind: ziyadah (new memorization), murajaah (review), tilawah_harian (daily reading).
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS setoran_kind text,
  ADD COLUMN IF NOT EXISTS min_pages integer;

ALTER TABLE public.tahfidz_mutabaah
  ADD COLUMN IF NOT EXISTS setoran_kind text,
  ADD COLUMN IF NOT EXISTS pages_count numeric;

COMMENT ON COLUMN public.question_bank.setoran_kind IS 'Halaqoh setoran type: ziyadah | murajaah | tilawah_harian';
COMMENT ON COLUMN public.question_bank.min_pages IS 'Minimum pages required per submission (e.g. daily tilawah min 1 page)';
COMMENT ON COLUMN public.tahfidz_mutabaah.setoran_kind IS 'Halaqoh setoran type: ziyadah | murajaah | tilawah_harian';
COMMENT ON COLUMN public.tahfidz_mutabaah.pages_count IS 'Pages the student submitted/recited';