CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_username_format CHECK (username = lower(username) AND username ~ '^[a-z0-9][a-z0-9._-]{2,39}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_unique ON public.user_profiles (username);
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

WITH source_users AS (
  SELECT
    id,
    lower(regexp_replace(trim(coalesce(
      raw_user_meta_data->>'username',
      raw_user_meta_data->>'display_name',
      split_part(email, '@', 1)
    )), '[^a-zA-Z0-9._-]', '', 'g')) AS base_username,
    created_at
  FROM auth.users
),
ranked_users AS (
  SELECT
    id,
    CASE
      WHEN length(base_username) < 3 THEN 'user_' || left(replace(id::text, '-', ''), 8)
      WHEN row_number() OVER (PARTITION BY base_username ORDER BY created_at, id) = 1 THEN left(base_username, 40)
      ELSE left(base_username, 30) || '_' || row_number() OVER (PARTITION BY base_username ORDER BY created_at, id)::text
    END AS username
  FROM source_users
)
INSERT INTO public.user_profiles (user_id, username)
SELECT id, username FROM ranked_users
WHERE username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'
ON CONFLICT (user_id) DO NOTHING;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_first_admin(_user_id uuid, _username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(918273645);

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'O primeiro administrador já foi criado.';
  END IF;

  IF _username !~ '^[a-z0-9][a-z0-9._-]{2,39}$' THEN
    RAISE EXCEPTION 'Nome de utilizador inválido.';
  END IF;

  INSERT INTO public.user_profiles (user_id, username)
  VALUES (_user_id, _username);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'staff'), (_user_id, 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_admin(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin(uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';