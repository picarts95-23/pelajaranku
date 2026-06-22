CREATE OR REPLACE FUNCTION public.list_students()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'guru') THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.*
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.list_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated;