
-- ============ TABLES (no helper refs yet) ============
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  subject text,
  academic_year text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO authenticated;
GRANT ALL ON public.class_enrollments TO service_role;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes WHERE id = _class_id AND teacher_id = _user_id
    UNION
    SELECT 1 FROM public.class_enrollments WHERE class_id = _class_id AND student_id = _user_id
  )
$$;

-- ============ POLICIES for classes + enrollments ============
CREATE POLICY "Teachers manage own classes" ON public.classes FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Members can view class" ON public.classes FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.class_enrollments e WHERE e.class_id = id AND e.student_id = auth.uid()
  ));
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "View own enrollment or as teacher" ON public.class_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_class_owner(class_id, auth.uid()));
CREATE POLICY "Students self enroll" ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teacher or self remove enrollment" ON public.class_enrollments FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.is_class_owner(class_id, auth.uid()));

-- ============ ASSIGNMENTS ============
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_at timestamptz,
  max_score integer NOT NULL DEFAULT 100,
  xp_reward integer NOT NULL DEFAULT 50,
  coin_reward integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages assignments" ON public.assignments FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Class members view assignments" ON public.assignments FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUBMISSIONS ============
CREATE TYPE submission_status AS ENUM ('draft','submitted','graded','returned');

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  file_url text,
  status submission_status NOT NULL DEFAULT 'submitted',
  score integer,
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  graded_at timestamptz,
  graded_by uuid REFERENCES auth.users(id),
  reward_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own submission" ON public.submissions FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Teachers view submissions" ON public.submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE POLICY "Teachers grade submissions" ON public.submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE TRIGGER trg_submissions_updated BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ATTENDANCE ============
CREATE TYPE attendance_status AS ENUM ('hadir','izin','sakit','alpa');

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  status attendance_status NOT NULL DEFAULT 'hadir',
  note text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages attendance" ON public.attendance FOR ALL TO authenticated
  USING (public.is_class_owner(class_id, auth.uid())) WITH CHECK (public.is_class_owner(class_id, auth.uid()));
CREATE POLICY "Student views own attendance" ON public.attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ JOURNALS ============
CREATE TABLE public.journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  topic text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journals TO authenticated;
GRANT ALL ON public.journals TO service_role;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages journals" ON public.journals FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Class members view journals" ON public.journals FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));
CREATE TRIGGER trg_journals_updated BEFORE UPDATE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EVENTS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages events" ON public.events FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Class members view events" ON public.events FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QUESTION BANK ============
CREATE TYPE question_type AS ENUM ('multiple_choice','essay','true_false');
CREATE TYPE question_difficulty AS ENUM ('easy','medium','hard');

CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text,
  topic text,
  question text NOT NULL,
  type question_type NOT NULL DEFAULT 'multiple_choice',
  options jsonb,
  answer text,
  difficulty question_difficulty NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher manages own questions" ON public.question_bank FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE TRIGGER trg_qb_updated BEFORE UPDATE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ BADGES ============
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  xp_requirement integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated view badges" ON public.badges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view user_badges" ON public.user_badges FOR SELECT TO authenticated USING (true);

-- ============ XP TRANSACTIONS ============
CREATE TABLE public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_id uuid,
  xp_amount integer NOT NULL DEFAULT 0,
  coin_amount integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_transactions TO authenticated;
GRANT ALL ON public.xp_transactions TO service_role;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User views own xp tx" ON public.xp_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============ TRIGGER: grant XP/coin when graded ============
CREATE OR REPLACE FUNCTION public.grant_submission_rewards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _xp integer; _coin integer; _max integer; _ratio numeric;
BEGIN
  IF NEW.status = 'graded' AND COALESCE(OLD.reward_granted, false) = false AND NEW.score IS NOT NULL THEN
    SELECT xp_reward, coin_reward, max_score INTO _xp, _coin, _max
      FROM public.assignments WHERE id = NEW.assignment_id;
    _ratio := LEAST(1.0, GREATEST(0.0, NEW.score::numeric / NULLIF(_max,0)));
    _xp := FLOOR(_xp * _ratio)::integer;
    _coin := FLOOR(_coin * _ratio)::integer;

    UPDATE public.profiles
      SET xp = xp + _xp,
          coins = coins + _coin,
          level = GREATEST(1, FLOOR((xp + _xp) / 100.0)::integer + 1)
      WHERE id = NEW.student_id;

    INSERT INTO public.xp_transactions (user_id, source, source_id, xp_amount, coin_amount, note)
      VALUES (NEW.student_id, 'assignment', NEW.assignment_id, _xp, _coin, 'Reward tugas dinilai');

    NEW.reward_granted := true;
    NEW.graded_at := COALESCE(NEW.graded_at, now());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_grant_rewards
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.grant_submission_rewards();

-- ============ SEED BADGES ============
INSERT INTO public.badges (code, name, description, icon, xp_requirement) VALUES
  ('first_quest','First Quest','Selesaikan tugas pertama','sword',0),
  ('perfect_score','Perfect Score','Raih nilai sempurna','star',0),
  ('streak_master','Streak Master','Hadir 7 hari berturut','flame',0),
  ('knowledge_seeker','Knowledge Seeker','Capai 500 XP','book',500),
  ('top_warrior','Top Warrior','Capai 1000 XP','crown',1000),
  ('loyal_student','Loyal Student','Capai level 5','shield',0)
ON CONFLICT (code) DO NOTHING;
