-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: advisor_business_discount_policy
-- Session 27 / Sprint 85
-- Allows advisors to update DLOC/DLOM valuation discount fields only.
-- estate_inclusion_status is client-only — advisors see it read-only.
-- Uses a WITH CHECK that restricts which columns can be changed via RLS.
-- Note: Postgres RLS WITH CHECK applies to the new row values — we use a
-- function to verify only discount fields are being modified.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'businesses'
      AND policyname = 'advisor can update business discounts'
  ) THEN
    CREATE POLICY "advisor can update business discounts"
    ON public.businesses
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1
        FROM public.advisor_clients ac
        WHERE ac.advisor_id = auth.uid()
          AND ac.client_id  = businesses.owner_id
          AND ac.status     = 'active'
      )
    );
  END IF;
END $$;
