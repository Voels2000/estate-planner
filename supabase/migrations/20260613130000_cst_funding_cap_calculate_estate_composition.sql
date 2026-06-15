-- CST / bypass path: use survivor-estate formula with CP funding cap (not flat G − 2×exemption).
-- taxable_with = max(0, (G − min(exemption, G/2)) − exemption)

DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid);
DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid, text);
DROP FUNCTION IF EXISTS public.calculate_estate_composition(uuid, text, numeric);

CREATE OR REPLACE FUNCTION public.calculate_estate_composition(
  p_household_id uuid,
  p_source_role text DEFAULT 'consumer'::text,
  p_lifetime_gifts_used numeric DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_household            households%ROWTYPE;
  v_owner_id             uuid;
  v_admin_pct            numeric;
  v_inside_financial     numeric := 0;
  v_inside_re            numeric := 0;
  v_inside_business      numeric := 0;
  v_inside_insurance     numeric := 0;
  v_inside_liquid        numeric := 0;
  v_inside_illiquid      numeric := 0;
  v_inside_total         numeric := 0;
  v_outside_struct       numeric := 0;
  v_outside_struct_items jsonb   := '[]'::jsonb;
  v_outside_strategy     numeric := 0;
  v_outside_strat_items  jsonb   := '[]'::jsonb;
  v_liabilities          numeric := 0;
  v_mortgage_total       numeric := 0;
  v_atg                  numeric := 0;
  v_gross_estate         numeric;
  v_net_estate           numeric;
  v_admin_expense        numeric;
  v_dloc_dlom_disc       numeric := 0;
  v_taxable_estate       numeric;
  v_exemption            numeric;
  v_tax_rate             numeric;
  v_exemption_used       numeric;
  v_exemption_remain     numeric;
  v_estimated_tax_federal numeric;
  v_state_code            text;
  v_is_mfj                boolean;
  v_state_exemption       numeric := 0;
  v_state_tax_year        integer;
  v_state_taxable_no_cst  numeric;
  v_state_taxable_cst     numeric;
  v_bypass_funding        numeric := 0;
  v_survivor_estate       numeric := 0;
  v_estimated_tax_state   numeric := 0;
  v_estimated_tax_state_with_cst numeric := 0;
  v_cst_benefit           numeric := 0;
  v_has_portability_gap   boolean := false;
  v_ny_cliff_triggered    boolean := false;
  v_state_tax_temp        numeric;
  v_no_portability_states text[] := ARRAY[
    'WA','OR','MN','MA','ME','IL','MD','NJ','RI','VT','HI',
    'DC','NE','IA','KY','PA'
  ];
BEGIN
  SELECT * INTO v_household FROM households WHERE id = p_household_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_owner_id  := v_household.owner_id;
  v_admin_pct := COALESCE(v_household.admin_expense_pct, 0.02);
  v_state_code := UPPER(TRIM(COALESCE(v_household.state_primary, '')));
  v_is_mfj    := v_household.filing_status = 'mfj';

  SELECT
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' THEN value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' AND liquidity = 'liquid'   THEN value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' AND liquidity = 'illiquid' THEN value ELSE 0 END), 0)
  INTO v_inside_financial, v_inside_liquid, v_inside_illiquid
  FROM assets WHERE owner_id = v_owner_id;

  SELECT
    COALESCE(SUM(value), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'name', name, 'value', value, 'status', estate_inclusion_status
    )), '[]'::jsonb)
  INTO v_outside_struct, v_outside_struct_items
  FROM assets
  WHERE owner_id = v_owner_id
    AND estate_inclusion_status IS DISTINCT FROM 'included'
    AND estate_inclusion_status IS NOT NULL;

  SELECT COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included'
    THEN current_value ELSE 0 END), 0)
  INTO v_inside_re FROM real_estate WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included'
    THEN estimated_value * (COALESCE(ownership_pct, 100) / 100.0)
    ELSE 0 END), 0)
  INTO v_inside_business FROM businesses WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(
    CASE WHEN estate_inclusion_status = 'included'
    THEN estimated_value * (COALESCE(ownership_pct, 100) / 100.0)
      * (1 - (1 - COALESCE(dloc_pct, 0)) * (1 - COALESCE(dlom_pct, 0)))
    ELSE 0 END
  ), 0)
  INTO v_dloc_dlom_disc FROM businesses WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(
    CASE WHEN policy_subtype IN ('term','whole','universal','variable')
      AND death_benefit IS NOT NULL
    THEN death_benefit ELSE 0 END
  ), 0)
  INTO v_inside_insurance
  FROM insurance_policies WHERE user_id = v_owner_id;

  SELECT COALESCE(SUM(balance), 0)
  INTO v_liabilities FROM liabilities WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(mortgage_balance), 0)
  INTO v_mortgage_total
  FROM real_estate
  WHERE owner_id = v_owner_id
    AND estate_inclusion_status = 'included'
    AND mortgage_balance IS NOT NULL;

  v_liabilities := v_liabilities + v_mortgage_total;

  SELECT COALESCE(SUM(amount), 0) INTO v_atg
  FROM adjusted_taxable_gifts WHERE household_id = p_household_id;

  SELECT
    COALESCE(SUM(amount * sign * -1), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'strategy_source', strategy_source,
      'amount', amount,
      'sign', sign,
      'confidence_level', confidence_level,
      'effective_year', effective_year
    )), '[]'::jsonb)
  INTO v_outside_strategy, v_outside_strat_items
  FROM strategy_line_items
  WHERE household_id = p_household_id
    AND is_active = true
    AND source_role = p_source_role
    AND confidence_level IN ('certain', 'probable');

  v_inside_total   := v_inside_financial + v_inside_re + v_inside_business + v_inside_insurance;
  v_gross_estate   := v_inside_total + v_outside_struct;
  v_net_estate     := v_gross_estate - v_liabilities;
  v_admin_expense  := v_gross_estate * v_admin_pct;
  v_taxable_estate := GREATEST(0,
    v_net_estate - v_admin_expense - v_dloc_dlom_disc - v_outside_strategy + v_atg
  );

  SELECT
    CASE WHEN v_household.filing_status = 'mfj'
      THEN COALESCE(estate_exemption_married, 30000000)
      ELSE COALESCE(estate_exemption_individual, 15000000)
    END,
    COALESCE(estate_top_rate_pct, 40) / 100
  INTO v_exemption, v_tax_rate
  FROM federal_tax_config WHERE is_active = true LIMIT 1;

  IF v_exemption IS NULL THEN
    v_exemption := CASE WHEN v_household.filing_status = 'mfj' THEN 30000000 ELSE 15000000 END;
    v_tax_rate  := 0.40;
  END IF;

  v_exemption := GREATEST(0, v_exemption - p_lifetime_gifts_used);
  v_exemption_used        := LEAST(v_taxable_estate, v_exemption);
  v_exemption_remain      := GREATEST(0, v_exemption - v_taxable_estate);
  v_estimated_tax_federal := GREATEST(0, (v_taxable_estate - v_exemption) * v_tax_rate);

  IF v_state_code != '' AND v_gross_estate > 0 THEN
    SELECT MAX(tax_year) INTO v_state_tax_year
    FROM state_estate_tax_rules WHERE state = v_state_code;

    IF v_state_tax_year IS NOT NULL THEN
      SELECT COALESCE(MAX(exemption_amount), 0)
      INTO v_state_exemption
      FROM state_estate_tax_rules
      WHERE state = v_state_code AND tax_year = v_state_tax_year;

      v_has_portability_gap := v_is_mfj AND (v_state_code = ANY(v_no_portability_states));

      IF v_state_code = 'NY' AND v_gross_estate > v_state_exemption * 1.05 THEN
        v_state_taxable_no_cst := v_gross_estate;
        v_ny_cliff_triggered   := true;
      ELSE
        v_state_taxable_no_cst := GREATEST(0, v_gross_estate - v_state_exemption);
      END IF;

      SELECT COALESCE(SUM(
        GREATEST(0, LEAST(v_state_taxable_no_cst, r.max_amount) - r.min_amount)
        * r.rate_pct / 100
      ), 0)
      INTO v_estimated_tax_state
      FROM state_estate_tax_rules r
      WHERE r.state = v_state_code
        AND r.tax_year = v_state_tax_year
        AND v_state_taxable_no_cst > r.min_amount;

      IF v_state_code = 'CT' THEN
        v_estimated_tax_state := LEAST(v_estimated_tax_state, 15000000);
      END IF;

      IF v_has_portability_gap THEN
        v_bypass_funding := LEAST(v_state_exemption, v_gross_estate / 2.0);
        v_survivor_estate := GREATEST(0, v_gross_estate - v_bypass_funding);

        IF v_state_code = 'NY' AND v_survivor_estate > v_state_exemption * 1.05 THEN
          v_state_taxable_cst := v_survivor_estate;
        ELSE
          v_state_taxable_cst := GREATEST(0, v_survivor_estate - v_state_exemption);
        END IF;

        SELECT COALESCE(SUM(
          GREATEST(0, LEAST(v_state_taxable_cst, r.max_amount) - r.min_amount)
          * r.rate_pct / 100
        ), 0)
        INTO v_estimated_tax_state_with_cst
        FROM state_estate_tax_rules r
        WHERE r.state = v_state_code
          AND r.tax_year = v_state_tax_year
          AND v_state_taxable_cst > r.min_amount;

        IF v_state_code = 'CT' THEN
          v_estimated_tax_state_with_cst := LEAST(v_estimated_tax_state_with_cst, 15000000);
        END IF;
      ELSE
        v_estimated_tax_state_with_cst := v_estimated_tax_state;
      END IF;

      v_cst_benefit := GREATEST(0, v_estimated_tax_state - v_estimated_tax_state_with_cst);

    END IF;
  END IF;

  RETURN jsonb_build_object(
    'gross_estate',               v_gross_estate,
    'inside_total',               v_inside_total,
    'inside_financial',           v_inside_financial,
    'inside_real_estate',         v_inside_re,
    'inside_business_gross',      v_inside_business,
    'inside_insurance',           v_inside_insurance,
    'inside_liquid',              v_inside_liquid,
    'inside_illiquid',            v_inside_illiquid,
    'outside_structure_total',    v_outside_struct,
    'outside_structure_items',    v_outside_struct_items,
    'outside_strategy_total',     v_outside_strategy,
    'outside_strategy_items',     v_outside_strat_items,
    'liabilities',                v_liabilities,
    'net_estate',                 v_net_estate,
    'admin_expense',              v_admin_expense,
    'admin_expense_pct',          v_admin_pct,
    'dloc_dlom_discount',         v_dloc_dlom_disc,
    'taxable_estate',             v_taxable_estate,
    'exemption_available',        v_exemption,
    'exemption_used',             v_exemption_used,
    'exemption_remaining',        v_exemption_remain,
    'estimated_tax_federal',      v_estimated_tax_federal,
    'estimated_tax_state',        v_estimated_tax_state,
    'estimated_tax_state_with_cst', v_estimated_tax_state_with_cst,
    'cst_benefit',                v_cst_benefit,
    'has_portability_gap',        v_has_portability_gap,
    'ny_cliff_triggered',         v_ny_cliff_triggered,
    'estimated_tax',              v_estimated_tax_federal + v_estimated_tax_state,
    'lifetime_gifts_used',        p_lifetime_gifts_used,
    'adjusted_taxable_gifts',     round(v_atg, 2),
    'source_role',                p_source_role
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO service_role;
