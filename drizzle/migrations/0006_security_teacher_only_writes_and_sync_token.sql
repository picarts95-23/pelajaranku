DROP POLICY IF EXISTS "Teachers manage own classes" ON public.classes;
CREATE POLICY "Teachers manage own classes" ON public.classes FOR ALL TO authenticated
  USING (teacher_id = (select auth.uid()))
  WITH CHECK (teacher_id = (select auth.uid()) AND (select public.has_role((select auth.uid()), 'guru')));

DROP POLICY IF EXISTS "Teacher manages events" ON public.events;
CREATE POLICY "Teacher manages events" ON public.events FOR ALL TO authenticated
  USING (teacher_id = (select auth.uid()))
  WITH CHECK (teacher_id = (select auth.uid()) AND (select public.has_role((select auth.uid()), 'guru')));

DROP POLICY IF EXISTS "Teacher manages journals" ON public.journals;
CREATE POLICY "Teacher manages journals" ON public.journals FOR ALL TO authenticated
  USING (teacher_id = (select auth.uid()))
  WITH CHECK (teacher_id = (select auth.uid()) AND (select public.has_role((select auth.uid()), 'guru')));

DROP POLICY IF EXISTS "Teacher manages own questions" ON public.question_bank;
CREATE POLICY "Teacher manages own questions" ON public.question_bank FOR ALL TO authenticated
  USING (teacher_id = (select auth.uid()))
  WITH CHECK (teacher_id = (select auth.uid()) AND (select public.has_role((select auth.uid()), 'guru')));

DROP POLICY IF EXISTS "All authenticated view badges" ON public.badges;
CREATE POLICY "Users with a role view badges" ON public.badges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (select auth.uid())));

CREATE TABLE IF NOT EXISTS public.internal_sync_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_sync_tokens FROM anon, authenticated;
GRANT ALL ON public.internal_sync_tokens TO service_role;
ALTER TABLE public.internal_sync_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_sync_tokens (name, token)
VALUES ('sheet_sync', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_sheet_sync_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_sync_tokens WHERE name = 'sheet_sync' AND token = _token);
$$;
REVOKE EXECUTE ON FUNCTION public.verify_sheet_sync_token(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sheet_sync_token(text) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-database-sheet-backup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('daily-database-sheet-backup', '0 0 * * *', $cron$
  SELECT net.http_post(
    url := 'https://project--f5cf3670-6c91-42a4-8b58-62eef730909d.lovable.app/api/public/hooks/sync-sheets',
    headers := jsonb_build_object('Content-Type','application/json','x-sync-token',
      (SELECT token FROM public.internal_sync_tokens WHERE name = 'sheet_sync')),
    body := '{}'::jsonb
  ) AS request_id;
$cron$);