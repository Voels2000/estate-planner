CREATE OR REPLACE FUNCTION public.calculate_estate_composition(
  p_household_id uuid,
  p_source_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household households%ROWTYPE;
  v_owner_id uuid;

  v_exemption_individual numeric := 15000000;
  v_exemption_married numeric := 30000000;
  v_exemption_available numeric := 15000000;
  v_exemption_remaining numeric := 0;

  v_inside_financial numeric := 0;
  v_inside_financial_liquid numeric := 0;
  v_inside_financial_illiquid numeric := 0;
  v_inside_real_estate numeric := 0;
  v_inside_business numeric := 0;
  v_dloc_dlom_disc numeric := 0;
  v_inside_business_taxable numeric := 0;
  v_inside_insurance numeric := 0;
  v_inside_total numeric := 0;
  v_inside_liquid numeric := 0;
  v_inside_illiquid numeric := 0;

  v_outside_struct numeric := 0;
  v_outside_structure_total numeric := 0;
  v_outside_structure_items jsonb := '[]'::jsonb;
  v_outside_strategy_total numeric := 0;
  v_outside_strategy_items jsonb := '[]'::jsonb;

  v_gross_estate numeric := 0;
  v_total_liabilities numeric := 0;
  v_mortgage_total numeric := 0;
  v_net_estate numeric := 0;
  v_admin_expense numeric := 0;
  v_marital_deduction numeric := 0;
  v_adjusted_taxable_gifts numeric := 0;
  v_valuation_discount_total numeric := 0;
  v_taxable_estate numeric := 0;
  v_estimated_tax numeric := 0;

  v_state_tax_result jsonb := '{}'::jsonb;
  v_estimated_tax_state numeric := 0;
  v_estimated_tax_state_with_cst numeric := 0;
  v_cst_benefit numeric := 0;
  v_has_portability_gap boolean := false;
  v_ny_cliff_triggered boolean := false;

  v_asset_rec record;
BEGIN
  SELECT * INTO v_household
  FROM households
  WHERE id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Household not found');
  END IF;

  v_owner_id := v_household.owner_id;

  BEGIN
    SELECT
      COALESCE(estate_exemption_individual, 15000000),
      COALESCE(estate_exemption_married, 30000000)
    INTO v_exemption_individual, v_exemption_married
    FROM federal_tax_config
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN NULL;
  END;

  v_exemption_available := CASE
    WHEN COALESCE(v_household.filing_status, '') IN ('mfj', 'married_filing_jointly', 'married_joint')
      AND COALESCE(v_household.has_spouse, false)
      THEN v_exemption_married
    ELSE v_exemption_individual
  END;

  FOR v_asset_rec IN
    SELECT
      a.id,
      a.name,
      a.value,
      a.liquidity,
      a.estate_inclusion_status
    FROM assets a
    WHERE a.owner_id = v_owner_id
  LOOP
    IF v_asset_rec.estate_inclusion_status = 'included' THEN
      v_inside_financial := v_inside_financial + COALESCE(v_asset_rec.value, 0);
      IF COALESCE(v_asset_rec.liquidity, 'liquid') = 'liquid' THEN
        v_inside_financial_liquid := v_inside_financial_liquid + COALESCE(v_asset_rec.value, 0);
      ELSE
        v_inside_financial_illiquid := v_inside_financial_illiquid + COALESCE(v_asset_rec.value, 0);
      END IF;
    ELSE
      v_outside_structure_total := v_outside_structure_total + COALESCE(v_asset_rec.value, 0);
      v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
        'name', v_asset_rec.name,
        'value', v_asset_rec.value,
        'asset_class', 'financial',
        'exclusion_type', v_asset_rec.estate_inclusion_status
      );
    END IF;
  END LOOP;

  FOR v_asset_rec IN
    SELECT
      re.id,
      re.name,
      re.current_value,
      re.estate_inclusion_status
    FROM real_estate re
    WHERE re.owner_id = v_owner_id
  LOOP
    IF v_asset_rec.estate_inclusion_status = 'included' THEN
      v_inside_real_estate := v_inside_real_estate + COALESCE(v_asset_rec.current_value, 0);
    ELSE
      v_outside_structure_total := v_outside_structure_total + COALESCE(v_asset_rec.current_value, 0);
      v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
        'name', v_asset_rec.name,
        'value', v_asset_rec.current_value,
        'asset_class', 'real_estate',
        'exclusion_type', v_asset_rec.estate_inclusion_status
      );
    END IF;
  END LOOP;

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

  v_valuation_discount_total := v_dloc_dlom_disc;
  v_inside_business_taxable := GREATEST(0, v_inside_business - v_dloc_dlom_disc);

  SELECT COALESCE(SUM(
    CASE WHEN policy_subtype IN ('term','whole','universal','variable')
      AND death_benefit IS NOT NULL
    THEN death_benefit ELSE 0 END
  ), 0)
  INTO v_inside_insurance
  FROM insurance_policies WHERE user_id = v_owner_id;

  v_inside_total := v_inside_financial + v_inside_real_estate + v_inside_business + v_inside_insurance;
  v_inside_liquid := v_inside_financial_liquid + v_inside_insurance;
  v_inside_illiquid := v_inside_financial_illiquid + v_inside_real_estate + v_inside_business;

  v_outside_struct := v_outside_structure_total;
  v_gross_estate := v_inside_total + v_outside_struct;

  SELECT COALESCE(SUM(balance), 0)
  INTO v_total_liabilities FROM liabilities WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(mortgage_balance), 0)
  INTO v_mortgage_total
  FROM real_estate
  WHERE owner_id = v_owner_id
    AND estate_inclusion_status = 'included'
    AND mortgage_balance IS NOT NULL;

  v_total_liabilities := v_total_liabilities + v_mortgage_total;

  v_net_estate := v_gross_estate - v_total_liabilities;
  v_admin_expense := v_gross_estate * COALESCE(v_household.admin_expense_pct, 0.02);

  v_marital_deduction := CASE
    WHEN COALESCE(v_household.filing_status, '') IN ('mfj', 'married_filing_jointly', 'married_joint')
      AND COALESCE(v_household.has_spouse, false)
      THEN v_gross_estate
    ELSE 0
  END;

  SELECT COALESCE(SUM(atg.amount), 0)
  INTO v_adjusted_taxable_gifts
  FROM adjusted_taxable_gifts atg
  WHERE atg.household_id = p_household_id
    AND atg.three_year_clawback = false;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'strategy_source', sli.strategy_source,
        'category', sli.category,
        'amount', sli.amount,
        'confidence_level', sli.confidence_level,
        'effective_year', sli.effective_year,
        'metadata', sli.metadata
      )
      ORDER BY sli.confidence_level, sli.amount DESC
    ),
    '[]'::jsonb
  )
  INTO v_outside_strategy_items
  FROM strategy_line_items sli
  WHERE sli.household_id = p_household_id
    AND sli.is_active = true
    AND sli.projection_year IS NULL
    AND sli.sign = -1;

  SELECT COALESCE(SUM(sli.amount), 0)
  INTO v_outside_strategy_total
  FROM strategy_line_items sli
  WHERE sli.household_id = p_household_id
    AND sli.is_active = true
    AND sli.projection_year IS NULL
    AND sli.sign = -1;

  v_taxable_estate := GREATEST(0,
      v_gross_estate
    - v_total_liabilities
    - v_admin_expense
    - v_valuation_discount_total
    + v_adjusted_taxable_gifts
  );

  v_exemption_remaining := GREATEST(0, v_exemption_available - v_taxable_estate);
  v_estimated_tax := CASE
    WHEN v_taxable_estate > v_exemption_available
      THEN (v_taxable_estate - v_exemption_available) * 0.40
    ELSE 0
  END;

  BEGIN
    SELECT calculate_state_estate_tax(p_household_id) INTO v_state_tax_result;
  EXCEPTION
    WHEN undefined_function THEN
      v_state_tax_result := '{}'::jsonb;
  END;

  v_estimated_tax_state := COALESCE((v_state_tax_result->>'estimated_tax')::numeric, 0);
  v_estimated_tax_state_with_cst := COALESCE((v_state_tax_result->>'estimated_tax_with_cst')::numeric, v_estimated_tax_state);
  v_cst_benefit := COALESCE((v_state_tax_result->>'cst_benefit')::numeric, GREATEST(0, v_estimated_tax_state - v_estimated_tax_state_with_cst));
  v_has_portability_gap := COALESCE((v_state_tax_result->>'has_portability_gap')::boolean, false);
  v_ny_cliff_triggered := COALESCE((v_state_tax_result->>'ny_cliff_triggered')::boolean, false);

  RETURN jsonb_build_object(
    'success', true,
    'source_role', p_source_role,
    'filing_status', COALESCE(v_household.filing_status, 'single'),
    'has_spouse', COALESCE(v_household.has_spouse, false),
    'inside_total', ROUND(v_inside_total, 2),
    'inside_financial', ROUND(v_inside_financial, 2),
    'inside_financial_liquid', ROUND(v_inside_financial_liquid, 2),
    'inside_financial_illiquid', ROUND(v_inside_financial_illiquid, 2),
    'inside_real_estate', ROUND(v_inside_real_estate, 2),
    'inside_business_gross', ROUND(v_inside_business, 2),
    'inside_business_taxable', ROUND(v_inside_business_taxable, 2),
    'inside_insurance', ROUND(v_inside_insurance, 2),
    'inside_liquid', ROUND(v_inside_liquid, 2),
    'inside_illiquid', ROUND(v_inside_illiquid, 2),
    'outside_structure_total', ROUND(v_outside_structure_total, 2),
    'outside_structure_items', v_outside_structure_items,
    'outside_strategy_total', ROUND(v_outside_strategy_total, 2),
    'outside_strategy_items', v_outside_strategy_items,
    'gross_estate', ROUND(v_gross_estate, 2),
    'total_liabilities', ROUND(v_total_liabilities, 2),
    'net_estate', ROUND(v_net_estate, 2),
    'admin_expense', ROUND(v_admin_expense, 2),
    'admin_expense_pct', COALESCE(v_household.admin_expense_pct, 0.02),
    'valuation_discount_total', ROUND(v_valuation_discount_total, 2),
    'marital_deduction', ROUND(v_marital_deduction, 2),
    'adjusted_taxable_gifts', ROUND(v_adjusted_taxable_gifts, 2),
    'taxable_estate', ROUND(v_taxable_estate, 2),
    'exemption_available', ROUND(v_exemption_available, 2),
    'exemption_remaining', ROUND(v_exemption_remaining, 2),
    'estimated_tax', ROUND(v_estimated_tax, 2),
    'estimated_tax_state', ROUND(v_estimated_tax_state, 2),
    'estimated_tax_state_with_cst', ROUND(v_estimated_tax_state_with_cst, 2),
    'cst_benefit', ROUND(v_cst_benefit, 2),
    'has_portability_gap', v_has_portability_gap,
    'ny_cliff_triggered', v_ny_cliff_triggered
  );
END;
$$;
