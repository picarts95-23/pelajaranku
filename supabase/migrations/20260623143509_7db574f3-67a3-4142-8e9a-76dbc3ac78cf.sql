CREATE TABLE public.tahfidz_mutabaah (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT current_date,
  session_type text NOT NULL DEFAULT 'ziyadah',
  surah text,
  ayat_from integer,
  ayat_to integer,
  juz integer,
  tajwid_score integer NOT NULL DEFAULT 0,
  tajwid_errors integer NOT NULL DEFAULT 0,
  kelancaran_score integer NOT NULL DEFAULT 0,
  kelancaran_helps integer NOT NULL DEFAULT 0,
  fashohah_score integer NOT NULL DEFAULT 0,
  adab_aurat boolean NOT NULL DEFAULT true,
  adab_focus boolean NOT NULL DEFAULT true,
  adab_etika boolean NOT NULL DEFAULT true,
  total_score integer NOT NULL DEFAULT 0,
  predikat text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tahfidz_mutabaah TO authenticated;
GRANT ALL ON public.tahfidz_mutabaah TO service_role;

ALTER TABLE public.tahfidz_mutabaah ENABLE ROW LEVEL SECURITY;

-- Teachers manage only the records they created.
CREATE POLICY "Teachers manage own mutabaah"
ON public.tahfidz_mutabaah
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'))
WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'));

-- Students can read their own assessment records.
CREATE POLICY "Students read own mutabaah"
ON public.tahfidz_mutabaah
FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE TRIGGER trg_mutabaah_updated
BEFORE UPDATE ON public.tahfidz_mutabaah
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();