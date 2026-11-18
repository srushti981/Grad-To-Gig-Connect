DROP POLICY IF EXISTS "Companies are publicly readable" ON public.companies;
CREATE POLICY "Signed-in users read companies" ON public.companies FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Jobs are publicly readable" ON public.jobs;
CREATE POLICY "Signed-in users read jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);