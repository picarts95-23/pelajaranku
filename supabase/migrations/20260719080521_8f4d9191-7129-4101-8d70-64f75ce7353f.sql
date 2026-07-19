
CREATE TABLE public.teacher_calendar_feeds (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_calendar_feeds TO authenticated;
GRANT ALL ON public.teacher_calendar_feeds TO service_role;
ALTER TABLE public.teacher_calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own feed" ON public.teacher_calendar_feeds FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
