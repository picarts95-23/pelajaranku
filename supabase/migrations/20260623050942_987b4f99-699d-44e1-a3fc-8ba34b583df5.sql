CREATE TABLE public.material_reads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, material_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_reads TO authenticated;
GRANT ALL ON public.material_reads TO service_role;

ALTER TABLE public.material_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own material reads"
  ON public.material_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_material_reads_updated_at
  BEFORE UPDATE ON public.material_reads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();