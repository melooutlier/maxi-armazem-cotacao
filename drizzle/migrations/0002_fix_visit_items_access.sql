GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_items TO authenticated;
GRANT ALL ON public.visit_items TO service_role;
ALTER TABLE public.visit_items DROP CONSTRAINT visit_items_priority_check;
ALTER TABLE public.visit_items ADD CONSTRAINT visit_items_priority_check CHECK (priority = ANY (ARRAY['Urgente','Normal','Baixa','']));