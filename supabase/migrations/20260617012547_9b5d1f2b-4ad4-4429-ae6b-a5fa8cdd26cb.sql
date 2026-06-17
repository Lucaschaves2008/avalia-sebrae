
-- Restrict profiles SELECT to own profile; admins already covered by 'Admins manage profiles'
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Restrict judgments SELECT to own rows; admins already covered by 'Admins manage judgments'
DROP POLICY IF EXISTS "Judgments readable by authenticated" ON public.judgments;
CREATE POLICY "Users view own judgments"
  ON public.judgments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
