-- Revoke EXECUTE from anon and PUBLIC on all SECURITY DEFINER functions,
-- then grant EXECUTE only to the roles that legitimately need each function.

-- Pure trigger / internal functions: no direct caller should run them.
REVOKE ALL ON FUNCTION public.log_class_created() FROM anon, public;
REVOKE ALL ON FUNCTION public.log_enrollment_added() FROM anon, public;
REVOKE ALL ON FUNCTION public.log_enrollment_removed() FROM anon, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, public;
REVOKE ALL ON FUNCTION public.grant_submission_rewards() FROM anon, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE ALL ON FUNCTION public.protect_submission_grading() FROM anon, public;

-- Helper functions used by RLS policies: needed by signed-in users, not anon.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_class_owner(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_class_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid, uuid) TO authenticated;

-- RPCs called directly by signed-in users.
REVOKE ALL ON FUNCTION public.search_students(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.list_students() FROM anon, public;
REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.grade_quiz_submission(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_students(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_students() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_class_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grade_quiz_submission(uuid, jsonb) TO authenticated;