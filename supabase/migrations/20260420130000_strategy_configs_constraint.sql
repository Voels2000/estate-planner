-- Ensure strategy_configs table exists with correct shape
-- Safe to run even if table already exists in production

CREATE TABLE IF NOT EXISTS public.strategy_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  strategy_type   text NOT NULL,
  label           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint required for upsert onConflict: 'household_id,strategy_type'
-- IF NOT EXISTS syntax not available for constraints — use DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'strategy_configs_household_strategy_unique'
  ) THEN
    ALTER TABLE public.strategy_configs
      ADD CONSTRAINT strategy_configs_household_strategy_unique
      UNIQUE (household_id, strategy_type);
  END IF;
END $$;

ALTER TABLE public.strategy_configs ENABLE ROW LEVEL SECURITY;

-- PostgreSQL has no portable "create policy if not exists"; guard via pg_policies for idempotent runs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_configs'
      AND policyname = 'Advisors manage strategy configs'
  ) THEN
    CREATE POLICY "Advisors manage strategy configs"
      ON public.strategy_configs
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.advisor_clients ac
          JOIN public.households h ON h.owner_id = ac.client_id
          WHERE h.id = strategy_configs.household_id
            AND ac.advisor_id = auth.uid()
            AND ac.status = 'active'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'strategy_configs'
      AND policyname = 'Consumers read own strategy configs'
  ) THEN
    CREATE POLICY "Consumers read own strategy configs"
      ON public.strategy_configs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.households h
          WHERE h.id = strategy_configs.household_id
            AND h.owner_id = auth.uid()
        )
      );
  END IF;
END $$;
