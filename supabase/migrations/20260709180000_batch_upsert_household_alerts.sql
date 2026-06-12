-- Batch household alert writes + inline resolve (fewer client round trips and DB function calls).

CREATE OR REPLACE FUNCTION public.resolve_household_alerts_batch(
  p_household_id uuid,
  p_rule_ids text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_rule_ids IS NULL OR array_length(p_rule_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.household_alerts
  SET
    resolved_at = now(),
    updated_at = now()
  WHERE household_id = p_household_id
    AND rule_id = ANY(p_rule_ids)
    AND resolved_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_household_alerts_batch(
  p_household_id uuid,
  p_alerts jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alert jsonb;
BEGIN
  IF p_alerts IS NULL OR jsonb_typeof(p_alerts) <> 'array' OR jsonb_array_length(p_alerts) = 0 THEN
    RETURN;
  END IF;

  FOR v_alert IN SELECT value FROM jsonb_array_elements(p_alerts)
  LOOP
    PERFORM public.upsert_household_alert(
      p_household_id := p_household_id,
      p_rule_id := v_alert->>'rule_id',
      p_alert_type := v_alert->>'alert_type',
      p_severity := v_alert->>'severity',
      p_title := v_alert->>'title',
      p_description := v_alert->>'description',
      p_action_href := v_alert->>'action_href',
      p_action_label := v_alert->>'action_label',
      p_context_data := COALESCE(v_alert->'context_data', '{}'::jsonb)
    );
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.upsert_household_alerts_batch(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_household_alerts_batch(uuid, jsonb) TO service_role;
