-- Archive support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Admins can read every role row (for the user-management screen)
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can modify roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Hide archived students from teacher listings
CREATE OR REPLACE FUNCTION public.list_students()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, class_name text, subject text, xp integer, level integer, coins integer, username text, bio text, motto text, character_key text, created_at timestamp with time zone, updated_at timestamp with time zone, school_id_number text, gender text, birthdate date, hobby text)
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
  WHERE p.archived_at IS NULL
  ORDER BY p.full_name;
END;
$function$;