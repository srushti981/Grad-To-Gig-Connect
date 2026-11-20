DROP POLICY IF EXISTS "Signed-in users read jobs" ON public.jobs;
CREATE POLICY "Read open jobs, own jobs, or all as admin" ON public.jobs FOR SELECT TO authenticated
USING (status = 'open' OR posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Signed-in users read companies" ON public.companies;
CREATE POLICY "Read relevant companies" ON public.companies FOR SELECT TO authenticated
USING (
  verified
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.company_id = companies.id)
  OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.company_id = companies.id AND (j.status = 'open' OR j.posted_by = auth.uid()))
);