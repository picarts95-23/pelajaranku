-- 1) Teacher subjects: one teacher can teach multiple subjects
CREATE TABLE public.teacher_subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subjects TO authenticated;
GRANT ALL ON public.teacher_subjects TO service_role;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own subjects"
  ON public.teacher_subjects FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'))
  WITH CHECK (auth.uid() = teacher_id AND public.has_role(auth.uid(), 'guru'));

-- 2) Question link + game link on assignments, events, question_bank
ALTER TABLE public.assignments  ADD COLUMN IF NOT EXISTS quiz_link text, ADD COLUMN IF NOT EXISTS game_link text;
ALTER TABLE public.events       ADD COLUMN IF NOT EXISTS quiz_link text, ADD COLUMN IF NOT EXISTS game_link text;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS quiz_link text, ADD COLUMN IF NOT EXISTS game_link text;

-- 3) Google Calendar per-user connection (tokens are server-only, never exposed to client)
CREATE TABLE public.google_calendar_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: tokens are accessed only by server functions (service role).
CREATE TRIGGER trg_gcal_updated_at BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- track synced google event id on local events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS google_event_id text;