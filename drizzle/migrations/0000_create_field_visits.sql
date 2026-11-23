CREATE SEQUENCE public.visit_code_seq START WITH 1;

CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_code text UNIQUE,
  supermarket text NOT NULL,
  operator_name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'launched')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO anon;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared visit access" ON public.visits FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE TABLE public.visit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  product_code text NOT NULL,
  product_name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Urgente', 'Normal', 'Baixa')),
  launched boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, product_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visit_items TO anon;
GRANT ALL ON public.visit_items TO service_role;
ALTER TABLE public.visit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared visit item access" ON public.visit_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.assign_visit_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.visit_code := COALESCE(
      NEW.visit_code,
      'VIST-' || to_char(NEW.completed_at, 'YYYY') || '-' || lpad(nextval('public.visit_code_seq')::text, 4, '0')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER visits_assign_code_before_completion
BEFORE UPDATE OF status ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.assign_visit_code();