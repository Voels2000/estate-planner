-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: estate_metrics_asset_columns
-- Session 27 / Sprint 85
-- Adds estate_inclusion_status to all four asset tables.
-- Adds dloc_pct + dlom_pct to businesses (appraiser-supplied discount fields).
-- Adds admin_expense_pct to households (advisor-editable, default 2%).
-- Adds schema_version to households (v1 = pre-migration, v2 = new structure).
-- All columns are additive with safe defaults — no existing rows affected.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── assets ───────────────────────────────────────────────────────────────────
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS estate_inclusion_status text
    NOT NULL DEFAULT 'included'
    CHECK (estate_inclusion_status IN (
      'included',
      'excluded_irrevocable',
      'excluded_gifted',
      'excluded_other'
    ));

-- ── real_estate ───────────────────────────────────────────────────────────────
ALTER TABLE public.real_estate
  ADD COLUMN IF NOT EXISTS estate_inclusion_status text
    NOT NULL DEFAULT 'included'
    CHECK (estate_inclusion_status IN (
      'included',
      'excluded_irrevocable',
      'excluded_gifted',
      'excluded_other'
    ));

-- ── businesses ────────────────────────────────────────────────────────────────
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS estate_inclusion_status text
    NOT NULL DEFAULT 'included'
    CHECK (estate_inclusion_status IN (
      'included',
      'excluded_irrevocable',
      'excluded_gifted',
      'excluded_other'
    ));

-- Valuation discount fields — appraiser-supplied, multiplicative not additive.
-- Combined discount = 1 - (1 - dloc_pct) * (1 - dlom_pct)
-- Both default 0 so existing estate tax math is unchanged until advisor sets them.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS dloc_pct numeric(5,4) NOT NULL DEFAULT 0
    CHECK (dloc_pct >= 0 AND dloc_pct < 1);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS dlom_pct numeric(5,4) NOT NULL DEFAULT 0
    CHECK (dlom_pct >= 0 AND dlom_pct < 1);

-- ── insurance_policies ────────────────────────────────────────────────────────
ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS estate_inclusion_status text
    NOT NULL DEFAULT 'included'
    CHECK (estate_inclusion_status IN (
      'included',
      'excluded_irrevocable',
      'excluded_gifted',
      'excluded_other'
    ));

-- ── households ────────────────────────────────────────────────────────────────
-- Admin expense percentage — advisor-editable input with 2% default.
-- Deductible on Form 706. Typical range 1-4% of gross estate.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS admin_expense_pct numeric(5,4) NOT NULL DEFAULT 0.02
    CHECK (admin_expense_pct >= 0 AND admin_expense_pct <= 0.10);

-- Schema version — v1 = pre-Session-27 rows, v2 = new metrics structure.
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'v2';

-- Tag all existing rows as v1.
UPDATE public.households
  SET schema_version = 'v1'
  WHERE schema_version = 'v2';
