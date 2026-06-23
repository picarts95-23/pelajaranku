-- =========================================================
-- 1) ROLE SELF-ASSIGNMENT FIX: new users always become 'siswa'
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, class_name, school_id_number, subject)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'class_name',
    NEW.raw_user_meta_data->>'school_id_number',
    NEW.raw_user_meta_data->>'subject'
  );

  -- Role is NEVER taken from client-supplied metadata. Everyone starts as a student.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');

  RETURN NEW;
END;
$function$;

-- =========================================================
-- 2) PROFILE EXPOSURE FIX (#7): restrict full-row reads, add safe public view
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "View own profile or as teacher"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'guru'));

-- Safe, non-sensitive projection for student-to-student features (leaderboard, status, rosters).
CREATE OR REPLACE VIEW public.profiles_public AS
  SELECT id, full_name, avatar_url, class_name, subject,
         xp, level, coins, username, bio, motto, character_key,
         created_at, updated_at
  FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

-- =========================================================
-- 3) XP / COINS / LEVEL MANIPULATION FIX (#2): column-level UPDATE privileges
--    Reward columns can only be changed by the SECURITY DEFINER reward trigger.
-- =========================================================
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, avatar_url, class_name, school_id_number, subject,
  username, bio, gender, birthdate, hobby, motto, character_key, updated_at
) ON public.profiles TO authenticated;

-- =========================================================
-- 4) GOOGLE CALENDAR OAUTH TOKENS (#6): owner-only SELECT policy
-- =========================================================
DROP POLICY IF EXISTS "Users view own calendar connection" ON public.google_calendar_connections;
CREATE POLICY "Users view own calendar connection"
  ON public.google_calendar_connections
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 5) VOICE ANSWER FILES (#8): restrict reads to the owning student and the assignment's teacher
-- =========================================================
DROP POLICY IF EXISTS "Authenticated read voice answers" ON storage.objects;
CREATE POLICY "Owner or teacher read voice answers"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'voice-answers'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
        WHERE s.file_url = storage.objects.name
          AND a.teacher_id = auth.uid()
      )
    )
  );

-- =========================================================
-- 6) SECURITY DEFINER FUNCTION EXECUTE LOCKDOWN (#0028 / #0029)
-- =========================================================
-- Trigger-only functions: signed-in users and anon must NOT be able to call them directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_class_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_enrollment_added() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_enrollment_removed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_submission_rewards() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: never callable by anon; authenticated retains access only because
-- RLS policy evaluation needs it. Remove the public/anon grants.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid, uuid) FROM PUBLIC, anon;

-- Intentional authenticated RPCs (with internal authorization): block anon only.
REVOKE EXECUTE ON FUNCTION public.join_class_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_students(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_students() FROM PUBLIC, anon;