
CREATE TABLE public.class_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX class_activities_class_id_created_at_idx
  ON public.class_activities (class_id, created_at DESC);

GRANT SELECT, INSERT ON public.class_activities TO authenticated;
GRANT ALL ON public.class_activities TO service_role;

ALTER TABLE public.class_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view class activities"
  ON public.class_activities FOR SELECT
  TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));

CREATE POLICY "Class owner can insert activities"
  ON public.class_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_class_owner(class_id, auth.uid())
    AND actor_id = auth.uid()
  );

-- Trigger: class created
CREATE OR REPLACE FUNCTION public.log_class_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.class_activities (class_id, actor_id, action, metadata)
  VALUES (
    NEW.id,
    NEW.teacher_id,
    'class_created',
    jsonb_build_object('name', NEW.name, 'code', NEW.code)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_class_created
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.log_class_created();

-- Trigger: enrollment added
CREATE OR REPLACE FUNCTION public.log_enrollment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor uuid;
BEGIN
  _actor := COALESCE(auth.uid(), NEW.student_id);
  INSERT INTO public.class_activities (class_id, actor_id, action, target_user_id, metadata)
  VALUES (
    NEW.class_id,
    _actor,
    CASE WHEN _actor = NEW.student_id THEN 'student_joined' ELSE 'student_enrolled' END,
    NEW.student_id,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_enrollment_added
  AFTER INSERT ON public.class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.log_enrollment_added();

-- Trigger: enrollment removed
CREATE OR REPLACE FUNCTION public.log_enrollment_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

CREATE TRIGGER trg_log_enrollment_removed
  AFTER DELETE ON public.class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.log_enrollment_removed();
