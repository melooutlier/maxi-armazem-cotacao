DROP POLICY IF EXISTS "Read companies" ON public.companies;
CREATE POLICY "Staff read companies" ON public.companies FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));