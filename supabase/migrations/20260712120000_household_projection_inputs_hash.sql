-- Monte Carlo staleness gate: null hash = stale (safe default for existing rows).

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS projection_inputs_hash text;

COMMENT ON COLUMN public.households.projection_inputs_hash IS
  'SHA-256 of projection/MC input fields; NULL after household write until MC precompute completes.';
