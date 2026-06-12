-- Optimize calculate_state_estate_tax: fewer state_estate_tax_rules round-trips,
-- no unfiltered year-validation scan, index-friendly state + tax_year filters.

CREATE INDEX IF NOT EXISTS idx_state_estate_tax_rules_state_tax_year
  ON public.state_estate_tax_rules (state, tax_year);

CREATE OR REPLACE FUNCTION public.calculate_state_estate_tax(
  p_household_id uuid,
  p_tax_year integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tax_year INTEGER;
  v_owner_id UUID;
  v_state TEXT;
  v_filing_status TEXT;
  v_total_assets NUMERIC := 0;
  v_total_real_estate NUMERIC := 0;
  v_total_businesses NUMERIC := 0;
  v_total_insurance NUMERIC := 0;
  v_gross_estate NUMERIC := 0;
  v_marital_deduction NUMERIC := 0;
  v_adjusted_gross_estate NUMERIC := 0;
  v_state_exemption NUMERIC := 0;
  v_taxable_estate NUMERIC := 0;
  v_estimated_tax NUMERIC := 0;
  v_effective_rate NUMERIC := 0;
  v_remaining NUMERIC;
  v_bracket RECORD;
  v_bracket_amount NUMERIC;
  v_is_married BOOLEAN := false;
  v_has_state_tax BOOLEAN := false;
  v_ny_cliff_applies BOOLEAN := false;
  v_situs_tax JSONB;
  v_situs_record RECORD;
  v_situs_tax_amount NUMERIC := 0;
  v_situs_entry JSONB;
  v_max_year INTEGER;
BEGIN
  v_situs_tax := jsonb_build_array();
  v_tax_year := COALESCE(p_tax_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT);

  SELECT MAX(tax_year) INTO v_max_year FROM state_estate_tax_rules;
  IF v_max_year IS NOT NULL AND v_tax_year > v_max_year THEN
    v_tax_year := v_max_year;
  END IF;

  SELECT owner_id, filing_status, state_primary
  INTO v_owner_id, v_filing_status, v_state
  FROM households WHERE id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Household not found');
  END IF;

  IF v_filing_status IN ('mfj', 'married_filing_jointly', 'married') THEN
    v_is_married := true;
  END IF;

  SELECT COALESCE(SUM(value), 0) INTO v_total_assets
  FROM assets WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(current_value), 0) INTO v_total_real_estate
  FROM real_estate WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(estimated_value), 0) INTO v_total_businesses
  FROM businesses WHERE owner_id = v_owner_id;

  SELECT v_total_businesses + COALESCE(SUM(COALESCE(fmv_estimated, total_entity_value, 0)), 0)
  INTO v_total_businesses
  FROM business_interests WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(death_benefit), 0) INTO v_total_insurance
  FROM insurance_policies
  WHERE user_id = v_owner_id
    AND (is_ilit IS NULL OR is_ilit = false);

  v_gross_estate := v_total_assets + v_total_real_estate + v_total_businesses + v_total_insurance;

  IF v_is_married THEN
    v_marital_deduction := v_gross_estate * 0.5;
  END IF;

  v_adjusted_gross_estate := v_gross_estate - v_marital_deduction;

  -- Primary state: first pass captures exemption + has_state_tax
  FOR v_bracket IN
    SELECT min_amount, max_amount, rate_pct, exemption_amount
    FROM state_estate_tax_rules
    WHERE state = v_state
      AND tax_year = v_tax_year
    ORDER BY min_amount ASC
  LOOP
    v_has_state_tax := true;
    IF v_state_exemption = 0 THEN
      v_state_exemption := v_bracket.exemption_amount;
    END IF;
  END LOOP;

  IF v_has_state_tax THEN
    IF v_state = 'NY' AND v_gross_estate > (v_state_exemption * 1.05) THEN
      v_ny_cliff_applies := true;
      v_taxable_estate := v_gross_estate;
    ELSE
      v_taxable_estate := GREATEST(0, v_adjusted_gross_estate - v_state_exemption);
    END IF;

    IF v_taxable_estate > 0 THEN
      v_remaining := v_taxable_estate;

      FOR v_bracket IN
        SELECT min_amount, max_amount, rate_pct
        FROM state_estate_tax_rules
        WHERE state = v_state
          AND tax_year = v_tax_year
        ORDER BY min_amount ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        EXIT WHEN v_bracket.min_amount >= v_taxable_estate;
        v_bracket_amount := LEAST(v_remaining, v_bracket.max_amount - v_bracket.min_amount);
        v_estimated_tax := v_estimated_tax + (v_bracket_amount * v_bracket.rate_pct / 100.0);
        v_remaining := v_remaining - v_bracket_amount;
      END LOOP;

      IF v_adjusted_gross_estate > 0 THEN
        v_effective_rate := ROUND((v_estimated_tax / v_adjusted_gross_estate) * 100, 2);
      END IF;
    END IF;
  END IF;

  FOR v_situs_record IN
    SELECT r.name, r.current_value, r.situs_state
    FROM real_estate r
    WHERE r.owner_id = v_owner_id
      AND r.situs_state IS NOT NULL
      AND r.situs_state != v_state
      AND EXISTS (
        SELECT 1 FROM state_estate_tax_rules
        WHERE state = r.situs_state
          AND tax_year = v_tax_year
      )
  LOOP
    v_situs_tax_amount := 0;
    v_remaining := GREATEST(0, v_situs_record.current_value - (
      SELECT MIN(exemption_amount) FROM state_estate_tax_rules
      WHERE state = v_situs_record.situs_state
        AND tax_year = v_tax_year
    ));

    IF v_remaining > 0 THEN
      FOR v_bracket IN
        SELECT min_amount, max_amount, rate_pct
        FROM state_estate_tax_rules
        WHERE state = v_situs_record.situs_state
          AND tax_year = v_tax_year
        ORDER BY min_amount ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        EXIT WHEN v_bracket.min_amount >= v_situs_record.current_value;
        v_bracket_amount := LEAST(v_remaining, v_bracket.max_amount - v_bracket.min_amount);
        v_situs_tax_amount := v_situs_tax_amount + (v_bracket_amount * v_bracket.rate_pct / 100.0);
        v_remaining := v_remaining - v_bracket_amount;
      END LOOP;
    END IF;

    v_situs_entry := jsonb_build_object(
      'property', v_situs_record.name,
      'situs_state', v_situs_record.situs_state,
      'property_value', v_situs_record.current_value,
      'estimated_situs_tax', ROUND(v_situs_tax_amount, 2)
    );
    v_situs_tax := v_situs_tax || jsonb_build_array(v_situs_entry);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'tax_year', v_tax_year,
    'domicile_state', v_state,
    'has_state_estate_tax', v_has_state_tax,
    'filing_status', v_filing_status,
    'gross_estate', v_gross_estate,
    'marital_deduction', v_marital_deduction,
    'adjusted_gross_estate', v_adjusted_gross_estate,
    'state_exemption', v_state_exemption,
    'ny_cliff_applies', v_ny_cliff_applies,
    'taxable_estate', v_taxable_estate,
    'estimated_state_tax', ROUND(v_estimated_tax, 2),
    'effective_rate_pct', v_effective_rate,
    'out_of_state_property_tax', v_situs_tax
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
