DROP POLICY IF EXISTS "Read brands" ON public.brands;
CREATE POLICY "Staff read brands" ON public.brands FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
DROP POLICY IF EXISTS "Read product categories" ON public.product_categories;
CREATE POLICY "Staff read product categories" ON public.product_categories FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));
DROP POLICY IF EXISTS "Read product families" ON public.product_families;
CREATE POLICY "Staff read product families" ON public.product_families FOR SELECT TO authenticated USING ((select public.is_staff((select auth.uid()))));