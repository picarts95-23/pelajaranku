CREATE TABLE public.teacher_sheet_sync (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_id text,
  spreadsheet_url text,
  last_synced_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teacher_sheet_sync TO authenticated;
GRANT ALL ON public.teacher_sheet_sync TO service_role;

ALTER TABLE public.teacher_sheet_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers read own sheet sync"
  ON public.teacher_sheet_sync
  FOR SELECT
  TO authenticated
  USING (auth.uid() = teacher_id);

CREATE TRIGGER update_teacher_sheet_sync_updated_at
  BEFORE UPDATE ON public.teacher_sheet_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();