CREATE TABLE public.sheet_sync_state (
  id integer PRIMARY KEY DEFAULT 1,
  spreadsheet_id text,
  spreadsheet_url text,
  last_synced_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sheet_sync_singleton CHECK (id = 1)
);

GRANT SELECT ON public.sheet_sync_state TO authenticated;
GRANT ALL ON public.sheet_sync_state TO service_role;

ALTER TABLE public.sheet_sync_state ENABLE ROW LEVEL SECURITY;

-- Teachers may view the backup status (link + last sync time).
CREATE POLICY "Teachers view sheet sync state"
ON public.sheet_sync_state
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'guru'));

CREATE TRIGGER update_sheet_sync_state_updated_at
BEFORE UPDATE ON public.sheet_sync_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the singleton row.
INSERT INTO public.sheet_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;