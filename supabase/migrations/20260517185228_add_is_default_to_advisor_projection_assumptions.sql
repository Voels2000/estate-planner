-- Add is_default to advisor_projection_assumptions
-- Using IF NOT EXISTS throughout — safe to rerun

ALTER TABLE public.advisor_projection_assumptions
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.advisor_projection_assumptions.is_default IS
  'Advisor-marked default: one preset per advisor_id, or one client scenario per advisor_id + client_household_id.';

CREATE UNIQUE INDEX IF NOT EXISTS advisor_projection_assumptions_one_default_preset_idx
  ON public.advisor_projection_assumptions (advisor_id)
  WHERE is_preset = true AND is_default = true;
