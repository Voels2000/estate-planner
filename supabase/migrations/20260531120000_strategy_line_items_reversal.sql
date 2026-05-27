-- Strategy reversal audit trail (consumer-owned reversals)

ALTER TABLE public.strategy_line_items
  ADD COLUMN IF NOT EXISTS consumer_withdrawn boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text,
  ADD COLUMN IF NOT EXISTS reversed_from text,
  ADD COLUMN IF NOT EXISTS previously_active_at timestamptz;

COMMENT ON COLUMN public.strategy_line_items.consumer_withdrawn IS
  'True when consumer explicitly reversed an accepted/confirmed strategy.';

COMMENT ON COLUMN public.strategy_line_items.withdrawn_at IS
  'When the consumer withdrew; not updated after first withdrawal.';

COMMENT ON COLUMN public.strategy_line_items.reversal_reason IS
  'Optional consumer explanation; visible to connected advisor.';

COMMENT ON COLUMN public.strategy_line_items.reversed_from IS
  'confidence_level before reversal (audit trail).';

COMMENT ON COLUMN public.strategy_line_items.previously_active_at IS
  'When row was last promoted to probable or certain.';

CREATE INDEX IF NOT EXISTS idx_strategy_line_items_consumer_withdrawn
  ON public.strategy_line_items (consumer_withdrawn)
  WHERE consumer_withdrawn = true;
