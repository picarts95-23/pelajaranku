
-- 1) Stop the weekly auto-cleanup cron (safe if it doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'media-cleanup-weekly') THEN
    PERFORM cron.unschedule('media-cleanup-weekly');
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- pg_cron not installed; nothing to do
  NULL;
END $$;

-- 2) app_settings singleton table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  teacher_signup_mode text NOT NULL DEFAULT 'invite'
    CHECK (teacher_signup_mode IN ('auto', 'invite', 'closed')),
  teacher_access_code text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read the raw row (contains the teacher_access_code).
CREATE POLICY "Admin reads app settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin writes app settings"
  ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the singleton row.
INSERT INTO public.app_settings (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- 3) Public-ish mode getter (mode only, never the code) for the signup page.
CREATE OR REPLACE FUNCTION public.get_teacher_signup_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_signup_mode FROM public.app_settings WHERE id = 'singleton'
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_signup_mode() TO anon, authenticated;

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
