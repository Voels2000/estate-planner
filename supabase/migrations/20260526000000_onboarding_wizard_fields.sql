-- Sprint OB-1: extended profile fields + onboarding wizard completion tracking

ALTER TABLE households
  ADD COLUMN IF NOT EXISTS person1_first_name text,
  ADD COLUMN IF NOT EXISTS person2_first_name text,
  ADD COLUMN IF NOT EXISTS gross_estate_estimate text,
  ADD COLUMN IF NOT EXISTS has_minor_children boolean,
  ADD COLUMN IF NOT EXISTS has_business_interests boolean;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_wizard_completed_at timestamptz;

COMMENT ON COLUMN households.gross_estate_estimate IS
  'Self-reported net worth band: under_2m | 2m_5m | 5m_10m | 10m_20m | over_20m';
