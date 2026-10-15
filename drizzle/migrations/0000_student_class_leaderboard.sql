CREATE OR REPLACE FUNCTION public.student_class_leaderboard()
RETURNS TABLE(id uuid, full_name text, xp integer, level integer, coins integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.xp, p.level, p.coins
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'siswa'::public.app_role)
    AND public.has_role(p.id, 'siswa'::public.app_role)
    AND p.archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.class_enrollments mine
      JOIN public.class_enrollments peer ON peer.class_id = mine.class_id
      WHERE mine.student_id = auth.uid() AND peer.student_id = p.id
    )
  ORDER BY p.xp DESC, p.id;
$$;
REVOKE ALL ON FUNCTION public.student_class_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_class_leaderboard() TO authenticated, service_role;