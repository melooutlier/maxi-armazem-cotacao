-- Usernames are case-sensitive: preserve the exact spelling entered at account creation.
-- The ordinary unique index remains case-sensitive, so MaxiUser and maxiuser are distinct.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$');

NOTIFY pgrst, 'reload schema';
