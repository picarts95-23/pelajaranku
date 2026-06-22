ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'complex_multiple_choice';

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS subject text;

CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text,
  title text NOT NULL,
  description text,
  content text,
  link text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher manages own materials" ON public.materials
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Class members view materials" ON public.materials
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR (class_id IS NOT NULL AND public.is_class_member(class_id, auth.uid()))
  );

CREATE TRIGGER trg_materials_updated BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();