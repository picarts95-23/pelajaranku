-- Helper: does _uid share a class with _other (as co-student, or teacher<->student)?
CREATE OR REPLACE FUNCTION public.shares_class_with(_uid uuid, _other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- both enrolled as students in the same class
    SELECT 1
    FROM public.class_enrollments e1
    JOIN public.class_enrollments e2 ON e1.class_id = e2.class_id
    WHERE e1.student_id = _uid AND e2.student_id = _other
    UNION
    -- _uid teaches a class _other is enrolled in
    SELECT 1
    FROM public.classes c
    JOIN public.class_enrollments e ON e.class_id = c.id
    WHERE c.teacher_id = _uid AND e.student_id = _other
    UNION
    -- _other teaches a class _uid is enrolled in
    SELECT 1
    FROM public.classes c
    JOIN public.class_enrollments e ON e.class_id = c.id
    WHERE c.teacher_id = _other AND e.student_id = _uid
  )
$$;

-- Helper: can _uid see the status (own or author shares a class)?
CREATE OR REPLACE FUNCTION public.can_view_status(_status_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.statuses s
    WHERE s.id = _status_id
      AND (s.author_id = _uid OR public.shares_class_with(_uid, s.author_id))
  )
$$;

-- ===================== profiles =====================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Class members and staff can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_class_with(auth.uid(), id)
);

-- ===================== statuses =====================
DROP POLICY IF EXISTS "Authenticated can view statuses" ON public.statuses;
CREATE POLICY "Class members and staff can view statuses"
ON public.statuses
FOR SELECT
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_class_with(auth.uid(), author_id)
);

-- ===================== status_comments =====================
DROP POLICY IF EXISTS "Authenticated can view comments" ON public.status_comments;
CREATE POLICY "Class members and staff can view comments"
ON public.status_comments
FOR SELECT
TO authenticated
USING (
  auth.uid() = author_id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_view_status(status_id, auth.uid())
);

-- ===================== status_reactions =====================
DROP POLICY IF EXISTS "Authenticated can view reactions" ON public.status_reactions;
CREATE POLICY "Class members and staff can view status reactions"
ON public.status_reactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.can_view_status(status_id, auth.uid())
);

-- ===================== user_badges =====================
DROP POLICY IF EXISTS "Authenticated view user_badges" ON public.user_badges;
CREATE POLICY "Class members and staff can view user_badges"
ON public.user_badges
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_class_with(auth.uid(), user_id)
);

-- ===================== peer_reactions =====================
DROP POLICY IF EXISTS "Anyone signed in can read reactions" ON public.peer_reactions;
CREATE POLICY "Class members and staff can read peer reactions"
ON public.peer_reactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = reactor_id
  OR auth.uid() = target_student_id
  OR public.has_role(auth.uid(), 'guru')
  OR public.has_role(auth.uid(), 'admin')
  OR public.shares_class_with(auth.uid(), target_student_id)
);