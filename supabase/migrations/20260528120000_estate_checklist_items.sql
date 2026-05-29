-- =============================================================================
-- Estate execution checklist — persisted consumer checkbox state
-- Mirrors household-scoped checklist pattern (domicile_checklist_items)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.estate_checklist_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  task_key      text        NOT NULL,
  completed     boolean     NOT NULL DEFAULT false,
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, task_key)
);

ALTER TABLE public.estate_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own estate checklist items"
  ON public.estate_checklist_items
  FOR ALL
  TO authenticated
  USING (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT id FROM public.households WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Advisors can view client estate checklist items"
  ON public.estate_checklist_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      INNER JOIN public.households h ON h.owner_id = ac.client_id
      WHERE h.id = estate_checklist_items.household_id
        AND ac.advisor_id = auth.uid()
        AND ac.status = 'active'
        AND ac.accepted_at IS NOT NULL
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.estate_checklist_items TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_estate_checklist_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estate_checklist_updated_at ON public.estate_checklist_items;

CREATE TRIGGER estate_checklist_updated_at
  BEFORE UPDATE ON public.estate_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_estate_checklist_updated_at();
