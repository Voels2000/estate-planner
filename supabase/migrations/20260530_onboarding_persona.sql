ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_persona TEXT
    CHECK (onboarding_persona IN (
      'business_owner', 'real_estate', 'executive', 'accumulator'
    )),
  ADD COLUMN IF NOT EXISTS persona_set_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.onboarding_persona IS
  'Set once during onboarding. Drives persona-specific first-run UX. NULL = not yet answered.';
