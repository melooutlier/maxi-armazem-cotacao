ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
