CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.companies TO authenticated;
CREATE POLICY "Staff read companies" ON public.companies FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.companies (name) VALUES
  ('VIP Spar Sommerschield'),
  ('Supermercado Recheio Maputo'),
  ('Premier Supermercado Malhangalene'),
  ('Supermercado Laranjinha Polana')
ON CONFLICT (name) DO NOTHING;
