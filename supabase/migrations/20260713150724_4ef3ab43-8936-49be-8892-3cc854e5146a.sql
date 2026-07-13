-- Announcement board: teachers post announcements to a class; students react & comment.
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid() AND public.is_class_owner(class_id, auth.uid()));

CREATE POLICY "Class members view announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (public.is_class_member(class_id, auth.uid()));

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reactions (one emoji per user per announcement).
CREATE TABLE public.announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reactions TO authenticated;
GRANT ALL ON public.announcement_reactions TO service_role;
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view announcement reactions" ON public.announcement_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND public.is_class_member(a.class_id, auth.uid())));
CREATE POLICY "Users manage own announcement reaction" ON public.announcement_reactions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND public.is_class_member(a.class_id, auth.uid())));

-- Comments / feedback.
CREATE TABLE public.announcement_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_comments TO authenticated;
GRANT ALL ON public.announcement_comments TO service_role;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view announcement comments" ON public.announcement_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND public.is_class_member(a.class_id, auth.uid())));
CREATE POLICY "Members insert own announcement comments" ON public.announcement_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND public.is_class_member(a.class_id, auth.uid())));
CREATE POLICY "Users or teacher delete announcement comments" ON public.announcement_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.announcements a WHERE a.id = announcement_id AND a.teacher_id = auth.uid()));