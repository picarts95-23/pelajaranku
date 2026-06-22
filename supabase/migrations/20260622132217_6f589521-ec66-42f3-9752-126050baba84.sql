-- Badges: teachers manage the catalog
CREATE POLICY "Teachers insert badges" ON public.badges
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Teachers update badges" ON public.badges
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'guru'))
  WITH CHECK (public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Teachers delete badges" ON public.badges
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'guru'));

-- User badges: teachers award/revoke
CREATE POLICY "Teachers award badges" ON public.user_badges
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'guru'));

CREATE POLICY "Teachers revoke badges" ON public.user_badges
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'guru'));