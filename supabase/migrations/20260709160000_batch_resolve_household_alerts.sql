-- Batch resolve household alerts — one RPC round-trip instead of N per detectConflicts.

CREATE OR REPLACE FUNCTION public.resolve_household_alerts_batch(
  p_household_id uuid,
  p_rule_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule_id text;
BEGIN
  FOREACH v_rule_id IN ARRAY p_rule_ids
  LOOP
    PERFORM resolve_household_alert(p_household_id, v_rule_id);
  END LOOP;
END;
$function$;
