
REVOKE EXECUTE ON FUNCTION public.is_class_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_submission_rewards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;
