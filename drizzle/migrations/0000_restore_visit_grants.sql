GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_items TO authenticated;
GRANT ALL ON public.visits TO service_role;
GRANT ALL ON public.visit_items TO service_role;