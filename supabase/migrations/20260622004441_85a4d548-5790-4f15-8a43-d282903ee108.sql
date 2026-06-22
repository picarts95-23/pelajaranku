-- Social status feed for students: posts, comments, and emoji reactions

CREATE TABLE public.statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.statuses TO authenticated;
GRANT ALL ON public.statuses TO service_role;

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view statuses" ON public.statuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own status" ON public.statuses
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users update own status" ON public.statuses
  FOR UPDATE TO authenticated USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users delete own status" ON public.statuses
  FOR DELETE TO authenticated USING (author_id = auth.uid());

CREATE TRIGGER update_statuses_updated_at BEFORE UPDATE ON public.statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.status_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_comments TO authenticated;
GRANT ALL ON public.status_comments TO service_role;

ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view comments" ON public.status_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own comment" ON public.status_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users delete own comment" ON public.status_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());


CREATE TABLE public.status_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_id, emoji)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_reactions TO authenticated;
GRANT ALL ON public.status_reactions TO service_role;

ALTER TABLE public.status_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions" ON public.status_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own reaction" ON public.status_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own reaction" ON public.status_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());