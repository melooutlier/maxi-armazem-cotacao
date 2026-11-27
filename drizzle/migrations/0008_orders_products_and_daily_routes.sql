-- New ordering and daily-route domain. Existing visits, visit_items and companies are preserved.
-- Companies are retained; no operational or authentication data is deleted.

CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_families_brand_name_unique UNIQUE (brand_id, name)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL,
  unit text NOT NULL DEFAULT 'UN',
  image_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_active_name_idx ON public.products (active, name);
CREATE INDEX IF NOT EXISTS products_brand_idx ON public.products (brand_id);
CREATE INDEX IF NOT EXISTS products_family_idx ON public.products (family_id);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'processing', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_by_date_idx ON public.orders (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_company_date_idx ON public.orders (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_date_idx ON public.orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  unit text NOT NULL DEFAULT 'UN',
  quantity numeric(14,2) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON public.order_items (product_id);

CREATE TABLE IF NOT EXISTS public.daily_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date date NOT NULL,
  assigned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_routes_date_unique UNIQUE (route_date)
);

CREATE INDEX IF NOT EXISTS daily_routes_date_idx ON public.daily_routes (route_date DESC);

CREATE TABLE IF NOT EXISTS public.route_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.daily_routes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'not_visited')),
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT route_visits_route_company_unique UNIQUE (route_id, company_id)
);

CREATE INDEX IF NOT EXISTS route_visits_route_position_idx ON public.route_visits (route_id, position);

-- Enable row-level security on every new business table.
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_visits ENABLE ROW LEVEL SECURITY;

-- Authenticated staff can consult active catalogue data; only administrators manage it.
DROP POLICY IF EXISTS "Read brands" ON public.brands;
CREATE POLICY "Read brands" ON public.brands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage brands" ON public.brands;
CREATE POLICY "Admins manage brands" ON public.brands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Read product families" ON public.product_families;
CREATE POLICY "Read product families" ON public.product_families FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage product families" ON public.product_families;
CREATE POLICY "Admins manage product families" ON public.product_families FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Read active products" ON public.products;
CREATE POLICY "Read active products" ON public.products FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- The operator can create and consult their own orders; administrators can consult/manage all.
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status IN ('draft', 'submitted'));
DROP POLICY IF EXISTS "Users update own draft orders" ON public.orders;
CREATE POLICY "Users update own draft orders" ON public.orders FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() AND status = 'draft') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK ((created_by = auth.uid() AND status IN ('draft', 'submitted')) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Read order items by order access" ON public.order_items;
CREATE POLICY "Read order items by order access" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND (o.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
DROP POLICY IF EXISTS "Manage own draft order items" ON public.order_items;
CREATE POLICY "Manage own draft order items" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.created_by = auth.uid() AND o.status = 'draft'
  ));
DROP POLICY IF EXISTS "Update own draft order items" ON public.order_items;
CREATE POLICY "Update own draft order items" ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.created_by = auth.uid() AND o.status = 'draft'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.created_by = auth.uid() AND o.status = 'draft'
  ));
DROP POLICY IF EXISTS "Delete own draft order items" ON public.order_items;
CREATE POLICY "Delete own draft order items" ON public.order_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id AND o.created_by = auth.uid() AND o.status = 'draft'
  ));

-- Routes are assigned by admins. Only the assigned operator and admins can read them.
DROP POLICY IF EXISTS "Read assigned daily routes" ON public.daily_routes;
CREATE POLICY "Read assigned daily routes" ON public.daily_routes FOR SELECT TO authenticated
  USING (assigned_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage daily routes" ON public.daily_routes;
CREATE POLICY "Admins manage daily routes" ON public.daily_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Read assigned route visits" ON public.route_visits;
CREATE POLICY "Read assigned route visits" ON public.route_visits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_routes r
    WHERE r.id = route_id AND (r.assigned_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
DROP POLICY IF EXISTS "Operator updates assigned route visits" ON public.route_visits;
CREATE POLICY "Operator updates assigned route visits" ON public.route_visits FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.daily_routes r
    WHERE r.id = route_id AND r.assigned_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.daily_routes r
    WHERE r.id = route_id AND r.assigned_user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Admins manage route visits" ON public.route_visits;
CREATE POLICY "Admins manage route visits" ON public.route_visits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Company names/data remain intact. Only administrators can now change the registry.
DROP POLICY IF EXISTS "Staff access companies" ON public.companies;
DROP POLICY IF EXISTS "Read companies" ON public.companies;
CREATE POLICY "Read companies" ON public.companies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.brands, public.product_families TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.brands, public.product_families, public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_routes, public.route_visits TO authenticated;
GRANT ALL ON public.brands, public.product_families, public.products, public.orders, public.order_items, public.daily_routes, public.route_visits TO service_role;

NOTIFY pgrst, 'reload schema';
