
CREATE TABLE public.teacher_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teacher_invites TO authenticated;
GRANT ALL ON public.teacher_invites TO service_role;

ALTER TABLE public.teacher_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can read the full invite list from the client.
CREATE POLICY "Admins can view invites"
  ON public.teacher_invites FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All writes happen via server functions using the service role.
