CREATE TABLE public.learning_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject text NOT NULL,
  code text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_objectives TO authenticated;
GRANT ALL ON public.learning_objectives TO service_role;
ALTER TABLE public.learning_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own TP" ON public.learning_objectives FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'guru'));
CREATE POLICY "Class members read TP" ON public.learning_objectives FOR SELECT TO authenticated
  USING (class_id IS NOT NULL AND public.is_class_member(class_id, auth.uid()));
CREATE TRIGGER trg_lo_updated BEFORE UPDATE ON public.learning_objectives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.grade_weights (
  teacher_id uuid PRIMARY KEY,
  sumatif integer NOT NULL DEFAULT 60 CHECK (sumatif BETWEEN 0 AND 100),
  adab integer NOT NULL DEFAULT 20 CHECK (adab BETWEEN 0 AND 100),
  absensi integer NOT NULL DEFAULT 20 CHECK (absensi BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.grade_weights TO authenticated;
GRANT ALL ON public.grade_weights TO service_role;
ALTER TABLE public.grade_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own weights" ON public.grade_weights FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

ALTER TABLE public.assignments ADD COLUMN objective_id uuid REFERENCES public.learning_objectives(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN assessment_kind text NOT NULL DEFAULT 'sumatif' CHECK (assessment_kind IN ('formatif','sumatif'));