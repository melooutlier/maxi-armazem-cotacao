DROP POLICY IF EXISTS "Shared visit access" ON public.visits;
REVOKE ALL ON public.visits FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
CREATE POLICY "Authenticated team access" ON public.visits FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Shared visit item access" ON public.visit_items;
REVOKE ALL ON public.visit_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_items TO authenticated;
GRANT ALL ON public.visit_items TO service_role;
CREATE POLICY "Authenticated team access" ON public.visit_items FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);