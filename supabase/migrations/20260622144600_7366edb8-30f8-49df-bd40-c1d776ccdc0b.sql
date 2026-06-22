-- 1. Auto-create profile + role for every new auth user (function already exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill profiles for existing auth users missing one
INSERT INTO public.profiles (id, full_name, class_name, school_id_number, subject)
SELECT u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'class_name',
  u.raw_user_meta_data->>'school_id_number',
  u.raw_user_meta_data->>'subject'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 3. Backfill roles for existing auth users missing one (default siswa)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'role', 'siswa')::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Fix broken class view policy (was: e.class_id = e.id, always false)
DROP POLICY IF EXISTS "Members can view class" ON public.classes;
CREATE POLICY "Members can view class"
  ON public.classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.is_class_member(id, auth.uid()));

-- 5. Secure join-by-code RPC so students can find a class before they are enrolled
CREATE OR REPLACE FUNCTION public.join_class_by_code(_code text)
RETURNS public.classes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cls public.classes;
BEGIN
  IF NOT public.has_role(auth.uid(), 'siswa') THEN
    RAISE EXCEPTION 'NOT_A_STUDENT';
  END IF;

  SELECT * INTO _cls
  FROM public.classes
  WHERE upper(code) = upper(btrim(_code))
  LIMIT 1;

  IF _cls.id IS NULL THEN
    RAISE EXCEPTION 'CLASS_NOT_FOUND';
  END IF;

  INSERT INTO public.class_enrollments (class_id, student_id)
  VALUES (_cls.id, auth.uid())
  ON CONFLICT (class_id, student_id) DO NOTHING;

  RETURN _cls;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
