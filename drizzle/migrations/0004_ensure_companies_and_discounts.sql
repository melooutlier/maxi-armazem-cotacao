CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff access companies" ON public.companies;
CREATE POLICY "Staff access companies" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.visit_items ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_discount_percent_check;
ALTER TABLE public.visits ADD CONSTRAINT visits_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100);
ALTER TABLE public.visit_items DROP CONSTRAINT IF EXISTS visit_items_discount_percent_check;
ALTER TABLE public.visit_items ADD CONSTRAINT visit_items_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100);
NOTIFY pgrst, 'reload schema';