-- Revert the view-based approach (caused Security Definer View error)
DROP VIEW IF EXISTS public.profiles_public;
DROP POLICY IF EXISTS "View own profile or as teacher" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Private table for sensitive demographic data
CREATE TABLE public.profile_private (
  id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id_number text,
  gender text,
  birthdate date,
  hobby text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or teacher view private profile"
  ON public.profile_private FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'guru'));
CREATE POLICY "Owner inserts private profile"
  ON public.profile_private FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner updates private profile"
  ON public.profile_private FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profile_private_updated_at
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data
INSERT INTO public.profile_private (id, school_id_number, gender, birthdate, hobby)
SELECT id, school_id_number, gender, birthdate, hobby FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Drop sensitive columns from the broadly-readable profiles table
ALTER TABLE public.profiles
  DROP COLUMN school_id_number,
  DROP COLUMN gender,
  DROP COLUMN birthdate,
  DROP COLUMN hobby;

-- Re-apply column-level UPDATE privileges (#2) without the dropped columns
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, avatar_url, class_name, subject,
  username, bio, motto, character_key, updated_at
) ON public.profiles TO authenticated;

-- handle_new_user: student role + write NIS into the private table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, class_name, subject)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'class_name',
    NEW.raw_user_meta_data->>'subject'
  );

  INSERT INTO public.profile_private (id, school_id_number)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'school_id_number');

  -- Role is NEVER read from client metadata: everyone starts as a student.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'siswa');

  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- search_students: keep signature, source NIS from the private table
CREATE OR REPLACE FUNCTION public.search_students(_term text)
RETURNS TABLE(id uuid, full_name text, class_name text, school_id_number text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.class_name, pp.school_id_number
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  WHERE _term = ''
     OR p.full_name ILIKE '%' || _term || '%'
     OR COALESCE(pp.school_id_number, '') ILIKE '%' || _term || '%'
  ORDER BY p.full_name
  LIMIT 30;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.search_students(text) FROM PUBLIC, anon;

-- list_students: change to explicit columns including the private fields (teacher-only)
DROP FUNCTION IF EXISTS public.list_students();
CREATE FUNCTION public.list_students()
RETURNS TABLE(
  id uuid, full_name text, avatar_url text, class_name text, subject text,
  xp integer, level integer, coins integer, username text, bio text,
  motto text, character_key text, created_at timestamptz, updated_at timestamptz,
  school_id_number text, gender text, birthdate date, hobby text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.avatar_url, p.class_name, p.subject,
         p.xp, p.level, p.coins, p.username, p.bio,
         p.motto, p.character_key, p.created_at, p.updated_at,
         pp.school_id_number, pp.gender, pp.birthdate, pp.hobby
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  LEFT JOIN public.profile_private pp ON pp.id = p.id
  ORDER BY p.full_name;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.list_students() FROM PUBLIC, anon;