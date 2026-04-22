-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: adjusted_taxable_gifts_table
-- Session 27 / Sprint 85
-- New table for post-1976 lifetime taxable gifts that reduce the estate tax
-- exemption available at death (IRC §2001(b)).
-- Separate from gift_history which tracks annual/strategy gifting activity.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.adjusted_taxable_gifts (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          uuid          NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  gift_year             int           NOT NULL CHECK (gift_year >= 1977),
  amount                numeric(15,2) NOT NULL CHECK (amount > 0),
  recipient_description text,
  -- three_year_clawback: true when gift tax was paid and death occurred
  -- within 3 years of the gift (IRC §2035). Marks gift for gross estate
  -- inclusion rather than just taxable estate ATG addition.
  three_year_clawback   boolean       NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS adjusted_taxable_gifts_household_idx
  ON public.adjusted_taxable_gifts(household_id);

CREATE INDEX IF NOT EXISTS adjusted_taxable_gifts_year_idx
  ON public.adjusted_taxable_gifts(household_id, gift_year);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.adjusted_taxable_gifts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'adjusted_taxable_gifts'
      AND policyname = 'Consumers manage own adjusted taxable gifts'
  ) THEN
    CREATE POLICY "Consumers manage own adjusted taxable gifts"
    ON public.adjusted_taxable_gifts
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.households h
        WHERE h.id       = adjusted_taxable_gifts.household_id
          AND h.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'adjusted_taxable_gifts'
      AND policyname = 'Advisors manage client adjusted taxable gifts'
  ) THEN
    CREATE POLICY "Advisors manage client adjusted taxable gifts"
    ON public.adjusted_taxable_gifts
    FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.advisor_clients ac
        JOIN public.households h ON h.owner_id = ac.client_id
        WHERE h.id          = adjusted_taxable_gifts.household_id
          AND ac.advisor_id = auth.uid()
          AND ac.status     = 'active'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'adjusted_taxable_gifts'
      AND trigger_name       = 'set_adjusted_taxable_gifts_updated_at'
  ) THEN
    CREATE TRIGGER set_adjusted_taxable_gifts_updated_at
    BEFORE UPDATE ON public.adjusted_taxable_gifts
    FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
  END IF;
END $$;
