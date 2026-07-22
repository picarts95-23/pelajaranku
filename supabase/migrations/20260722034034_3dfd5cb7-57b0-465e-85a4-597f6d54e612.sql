
CREATE TYPE public.task_request_status AS ENUM ('pending','accepted','declined','converted','cancelled');

CREATE TABLE public.task_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject text,
  title text NOT NULL,
  description text,
  desired_due_at timestamptz,
  status public.task_request_status NOT NULL DEFAULT 'pending',
  teacher_note text,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_requests TO authenticated;
GRANT ALL ON public.task_requests TO service_role;

ALTER TABLE public.task_requests ENABLE ROW LEVEL SECURITY;

-- Students can insert their own requests
CREATE POLICY "Students insert own request" ON public.task_requests
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Students can view their own requests
CREATE POLICY "Students view own requests" ON public.task_requests
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Students can cancel/edit their own pending request
CREATE POLICY "Students update own pending" ON public.task_requests
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid());

-- Students can delete their own pending request
CREATE POLICY "Students delete own pending" ON public.task_requests
  FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');

-- Teachers can view requests directed to them, or to a class they own
CREATE POLICY "Teachers view directed" ON public.task_requests
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR (class_id IS NOT NULL AND public.is_class_owner(class_id, auth.uid()))
  );

-- Teachers can respond/update requests directed to them
CREATE POLICY "Teachers respond directed" ON public.task_requests
  FOR UPDATE TO authenticated
  USING (
    teacher_id = auth.uid()
    OR (class_id IS NOT NULL AND public.is_class_owner(class_id, auth.uid()))
  )
  WITH CHECK (
    teacher_id = auth.uid()
    OR (class_id IS NOT NULL AND public.is_class_owner(class_id, auth.uid()))
  );

CREATE TRIGGER trg_task_requests_updated_at
  BEFORE UPDATE ON public.task_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX task_requests_student_idx ON public.task_requests(student_id, created_at DESC);
CREATE INDEX task_requests_teacher_idx ON public.task_requests(teacher_id, created_at DESC);
CREATE INDEX task_requests_class_idx ON public.task_requests(class_id, created_at DESC);
