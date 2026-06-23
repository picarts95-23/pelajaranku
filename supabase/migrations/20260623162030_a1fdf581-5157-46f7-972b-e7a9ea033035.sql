-- Fix: deleting a class failed because cascading the delete to class_enrollments
-- fired log_enrollment_removed, which tried to INSERT a class_activities row
-- referencing the class that was being deleted -> foreign key violation.
-- Guard the activity log so it skips logging when the parent class no longer exists.
CREATE OR REPLACE FUNCTION public.log_enrollment_removed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip activity logging when the parent class is being deleted (cascade),
  -- otherwise the FK to classes would fail.
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = OLD.class_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.class_activities (class_id, actor_id, action, target_user_id, metadata)
  VALUES (
    OLD.class_id,
    COALESCE(auth.uid(), OLD.student_id),
    'student_removed',
    OLD.student_id,
    '{}'::jsonb
  );
  RETURN OLD;
END;
$function$;