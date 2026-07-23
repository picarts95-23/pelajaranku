
ALTER TABLE public.tahfidz_mutabaah
  ADD COLUMN IF NOT EXISTS iqro_jilid integer,
  ADD COLUMN IF NOT EXISTS iqro_page integer,
  ADD COLUMN IF NOT EXISTS iqro_letters text[];

COMMENT ON COLUMN public.tahfidz_mutabaah.iqro_jilid IS 'Iqro book/jilid number 1-6';
COMMENT ON COLUMN public.tahfidz_mutabaah.iqro_page IS 'Iqro page number';
COMMENT ON COLUMN public.tahfidz_mutabaah.iqro_letters IS 'Selected hijaiyah letters for Iqro session';
