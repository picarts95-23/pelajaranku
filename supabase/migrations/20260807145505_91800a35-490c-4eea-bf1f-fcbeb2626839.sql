CREATE TABLE public.annual_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text,
  academic_year text,
  title text NOT NULL DEFAULT 'Program Tahunan',
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_programs TO authenticated;
GRANT ALL ON public.annual_programs TO service_role;
ALTER TABLE public.annual_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own annual programs" ON public.annual_programs
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER trg_annual_programs_updated BEFORE UPDATE ON public.annual_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.semester_programs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text,
  academic_year text,
  semester integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT 'Program Semester',
  notes text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.semester_programs TO authenticated;
GRANT ALL ON public.semester_programs TO service_role;
ALTER TABLE public.semester_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own semester programs" ON public.semester_programs
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER trg_semester_programs_updated BEFORE UPDATE ON public.semester_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();