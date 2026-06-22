CREATE OR REPLACE FUNCTION public.search_students(_term text)
RETURNS TABLE (id uuid, full_name text, class_name text, school_id_number text)
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
  SELECT p.id, p.full_name, p.class_name, p.school_id_number
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'siswa'
  WHERE _term = ''
     OR p.full_name ILIKE '%' || _term || '%'
     OR COALESCE(p.school_id_number, '') ILIKE '%' || _term || '%'
  ORDER BY p.full_name
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.search_students(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_students(text) TO authenticated;