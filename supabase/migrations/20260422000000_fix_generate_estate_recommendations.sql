-- Migration: Fix generate_estate_recommendations
-- Session 28 / Sprint 86
-- Fixes:
--   1. gross_estate now sourced from calculate_estate_composition (Session 27 RPC)
--      instead of calculate_federal_estate_tax (pre-Session 27, wrong values)
--   2. has_business_interests now queries `businesses` table (modern)
--      instead of `business_interests` (legacy, empty for most households)

CREATE OR REPLACE FUNCTION generate_estate_recommendations(p_household_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_filing_status TEXT;
  v_state TEXT;
  v_has_spouse BOOLEAN;
  v_gross_estate NUMERIC := 0;
  v_composition JSONB;
  v_state_result JSONB;
  v_federal_tax NUMERIC := 0;
  v_state_tax NUMERIC := 0;
  v_taxable_federal NUMERIC := 0;
  v_taxable_state NUMERIC := 0;
  v_complexity_score INTEGER := 0;
  v_complexity_flag TEXT;
  v_needs_will BOOLEAN := false;
  v_needs_trust BOOLEAN := false;
  v_needs_pour_over_will BOOLEAN := false;
  v_needs_dpoa BOOLEAN := false;
  v_needs_healthcare_directive BOOLEAN := false;
  v_needs_ilit BOOLEAN := false;
  v_needs_bypass_trust BOOLEAN := false;
  v_needs_gifting_strategy BOOLEAN := false;
  v_has_minor_beneficiaries BOOLEAN := false;
  v_has_special_needs BOOLEAN := false;
  v_has_business BOOLEAN := false;
  v_has_irrevocable_trust BOOLEAN := false;
  v_has_life_insurance BOOLEAN := false;
  v_life_insurance_value NUMERIC := 0;
  v_doc_will BOOLEAN := false;
  v_doc_dpoa BOOLEAN := false;
  v_doc_healthcare BOOLEAN := false;
  v_doc_trust BOOLEAN := false;
  v_gift_total NUMERIC := 0;
  v_recommendations JSONB;
  v_rec_list JSONB;
  v_tax_year INTEGER;
  v_state_has_no_portability BOOLEAN := false;
  v_state_exemption NUMERIC := 0;
  v_bypass_trust_reason TEXT;
BEGIN
  v_complexity_flag := 'low';
  v_tax_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  SELECT owner_id, filing_status, state_primary, has_spouse
  INTO v_owner_id, v_filing_status, v_state, v_has_spouse
  FROM households WHERE id = p_household_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Household not found');
  END IF;

  v_state_has_no_portability := v_state IN ('WA', 'OR', 'MA', 'MN', 'IL');

  SELECT COALESCE(exemption_amount, 0) INTO v_state_exemption
  FROM state_estate_tax_rules
  WHERE state = v_state AND tax_year = v_tax_year
  LIMIT 1;

  IF v_state_exemption = 0 AND v_state_has_no_portability THEN
    SELECT COALESCE(exemption_amount, 0) INTO v_state_exemption
    FROM state_estate_tax_rules
    WHERE state = v_state
    ORDER BY tax_year DESC LIMIT 1;
  END IF;

  -- FIX 1: Use calculate_estate_composition (Session 27 single source of truth)
  -- instead of calculate_federal_estate_tax (pre-Session 27, wrong gross estate)
  SELECT calculate_estate_composition(p_household_id) INTO v_composition;
  v_gross_estate    := COALESCE((v_composition->>'gross_estate')::NUMERIC, 0);
  v_federal_tax     := COALESCE((v_composition->>'estimated_tax')::NUMERIC, 0);
  v_taxable_federal := COALESCE((v_composition->>'taxable_estate')::NUMERIC, 0);

  -- State tax still uses its own RPC (composition doesn't compute state tax)
  SELECT calculate_state_estate_tax(p_household_id) INTO v_state_result;
  v_state_tax   := COALESCE((v_state_result->>'estimated_state_tax')::NUMERIC, 0);
  v_taxable_state := COALESCE((v_state_result->>'taxable_estate')::NUMERIC, 0);

  SELECT COALESCE(SUM(coverage_amount), 0) INTO v_life_insurance_value
  FROM insurance_policies WHERE user_id = v_owner_id AND insurance_type = 'life';
  v_has_life_insurance := v_life_insurance_value > 0;

  SELECT EXISTS(SELECT 1 FROM asset_beneficiaries WHERE owner_id = v_owner_id AND special_needs = true)
  INTO v_has_minor_beneficiaries;

  SELECT EXISTS(SELECT 1 FROM asset_beneficiaries WHERE owner_id = v_owner_id AND distribution_age IS NOT NULL AND distribution_age > 18)
  INTO v_has_special_needs;

  -- FIX 2: Query modern `businesses` table, not legacy `business_interests`
  SELECT EXISTS(SELECT 1 FROM businesses WHERE owner_id = v_owner_id)
  INTO v_has_business;

  SELECT EXISTS(SELECT 1 FROM trusts WHERE owner_id = v_owner_id AND is_irrevocable = true AND status = 'funded')
  INTO v_has_irrevocable_trust;

  SELECT EXISTS(SELECT 1 FROM estate_documents WHERE owner_id = v_owner_id AND doc_type = 'will' AND status = 'exists')
  INTO v_doc_will;

  SELECT EXISTS(SELECT 1 FROM estate_documents WHERE owner_id = v_owner_id AND doc_type = 'dpoa' AND status = 'exists')
  INTO v_doc_dpoa;

  SELECT EXISTS(SELECT 1 FROM estate_documents WHERE owner_id = v_owner_id AND (doc_type = 'advance_directive' OR doc_type = 'medical_poa') AND status = 'exists')
  INTO v_doc_healthcare;

  SELECT EXISTS(SELECT 1 FROM trusts WHERE owner_id = v_owner_id AND (trust_type = 'rlt' OR trust_type = 'testamentary') AND status IN ('existing', 'funded'))
  INTO v_doc_trust;

  SELECT COALESCE(SUM(total_lifetime_gifts), 0) INTO v_gift_total
  FROM lifetime_exemption_summary WHERE household_id = p_household_id;

  IF NOT v_doc_will THEN
    v_needs_will := true;
    v_complexity_score := v_complexity_score + 1;
  END IF;

  IF NOT v_doc_dpoa THEN
    v_needs_dpoa := true;
    v_complexity_score := v_complexity_score + 1;
  END IF;

  IF NOT v_doc_healthcare THEN
    v_needs_healthcare_directive := true;
    v_complexity_score := v_complexity_score + 1;
  END IF;

  IF NOT v_doc_trust AND v_gross_estate > 500000 THEN
    v_needs_trust := true;
    v_complexity_score := v_complexity_score + 2;
  END IF;

  IF v_needs_trust THEN
    v_needs_pour_over_will := true;
  END IF;

  IF v_has_spouse AND (
    v_taxable_federal > 0
    OR (v_state_has_no_portability AND v_gross_estate > v_state_exemption)
  ) THEN
    v_needs_bypass_trust := true;
    v_complexity_score := v_complexity_score + 3;
  END IF;

  IF v_needs_bypass_trust THEN
    IF v_state_has_no_portability AND v_gross_estate > v_state_exemption THEN
      v_bypass_trust_reason := CASE v_state
        WHEN 'WA' THEN format(
          'Washington does not allow portability of its state estate tax exemption. Without a Credit Shelter Trust funded at first death, the first spouse''s %s exemption is permanently lost. At second death, only one %s exemption applies against your full combined estate. A bypass trust preserves both exemptions and could reduce Washington estate tax by %s or more.',
          to_char(v_state_exemption, 'FM$9,999,999'),
          to_char(v_state_exemption, 'FM$9,999,999'),
          to_char(GREATEST(0, (v_gross_estate - v_state_exemption) * 0.10), 'FM$9,999,999')
        )
        WHEN 'OR' THEN format(
          'Oregon does not allow portability of its state estate tax exemption. Without a Credit Shelter Trust, the first spouse''s %s exemption is lost at first death. A bypass trust preserves both exemptions and could reduce Oregon estate tax significantly.',
          to_char(v_state_exemption, 'FM$9,999,999')
        )
        WHEN 'MA' THEN format(
          'Massachusetts does not allow portability of its state estate tax exemption. Without a Credit Shelter Trust, the first spouse''s %s exemption is lost at first death. Massachusetts estate tax rates reach 16%% — a bypass trust could meaningfully reduce your estate tax exposure.',
          to_char(v_state_exemption, 'FM$9,999,999')
        )
        WHEN 'MN' THEN format(
          'Minnesota does not allow portability of its state estate tax exemption. Without a Credit Shelter Trust, the first spouse''s %s exemption is lost at first death. A bypass trust preserves both exemptions and reduces Minnesota estate tax exposure.',
          to_char(v_state_exemption, 'FM$9,999,999')
        )
        WHEN 'IL' THEN format(
          'Illinois does not allow portability of its state estate tax exemption. Without a Credit Shelter Trust, the first spouse''s %s exemption is lost at first death. Illinois estate tax rates reach 16%% — a bypass trust could meaningfully reduce your estate tax exposure.',
          to_char(v_state_exemption, 'FM$9,999,999')
        )
        ELSE 'Bypass trust recommended to preserve both spouses'' exemptions.'
      END;
    ELSE
      v_bypass_trust_reason :=
        'Federal taxable estate detected. A bypass trust captures the first spouse''s exemption at first death, preventing estate growth from eroding it at second death.';
    END IF;
  END IF;

  IF v_has_life_insurance AND v_life_insurance_value > 500000 AND NOT v_has_irrevocable_trust THEN
    v_needs_ilit := true;
    v_complexity_score := v_complexity_score + 3;
  END IF;

  IF v_federal_tax > 0 OR v_state_tax > 0 OR v_gift_total > 0 THEN
    v_needs_gifting_strategy := true;
    v_complexity_score := v_complexity_score + 2;
  END IF;

  IF v_has_business THEN
    v_complexity_score := v_complexity_score + 3;
  END IF;

  IF v_has_special_needs OR v_has_minor_beneficiaries THEN
    v_complexity_score := v_complexity_score + 2;
  END IF;

  IF v_complexity_score <= 3 THEN v_complexity_flag := 'low';
  ELSIF v_complexity_score <= 7 THEN v_complexity_flag := 'moderate';
  ELSIF v_complexity_score <= 12 THEN v_complexity_flag := 'high';
  ELSE v_complexity_flag := 'critical';
  END IF;

  UPDATE households SET
    estate_complexity_score = v_complexity_score,
    estate_complexity_flag = v_complexity_flag,
    last_recommendation_at = now()
  WHERE id = p_household_id;

  v_rec_list := jsonb_build_array();

  IF v_needs_will THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'will', 'priority', 'high',
      'reason', 'No will on file. Assets may pass by intestacy.'
    ));
  END IF;

  IF v_needs_dpoa THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'dpoa', 'priority', 'high',
      'reason', 'No durable power of attorney on file.'
    ));
  END IF;

  IF v_needs_healthcare_directive THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'healthcare_directive', 'priority', 'high',
      'reason', 'No advance directive or medical POA on file.'
    ));
  END IF;

  IF v_needs_trust THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'revocable_living_trust', 'priority', 'moderate',
      'reason', 'Estate value exceeds $500K. Trust avoids probate and provides control.'
    ));
  END IF;

  IF v_needs_pour_over_will THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'pour_over_will', 'priority', 'moderate',
      'reason', 'Pour-over will recommended to complement revocable living trust.'
    ));
  END IF;

  IF v_needs_bypass_trust THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'bypass_trust',
      'priority', 'high',
      'reason', v_bypass_trust_reason,
      'state_no_portability', v_state_has_no_portability,
      'state_exemption', v_state_exemption
    ));
  END IF;

  IF v_needs_ilit THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'ilit', 'priority', 'high',
      'reason', 'Life insurance over $500K included in taxable estate. ILIT removes it from gross estate.'
    ));
  END IF;

  IF v_needs_gifting_strategy THEN
    v_rec_list := v_rec_list || jsonb_build_array(jsonb_build_object(
      'branch', 'gifting_strategy', 'priority', 'moderate',
      'reason', 'Estate tax exposure or existing gift history detected. Annual gifting strategy recommended.'
    ));
  END IF;

  v_recommendations := jsonb_build_object(
    'success',                    true,
    'tax_year',                   v_tax_year,
    'household_id',               p_household_id,
    'gross_estate',               v_gross_estate,
    'federal_estate_tax',         v_federal_tax,
    'state_estate_tax',           v_state_tax,
    'total_tax_exposure',         v_federal_tax + v_state_tax,
    'complexity_score',           v_complexity_score,
    'complexity_flag',            v_complexity_flag,
    'needs_will',                 v_needs_will,
    'needs_trust',                v_needs_trust,
    'needs_pour_over_will',       v_needs_pour_over_will,
    'needs_dpoa',                 v_needs_dpoa,
    'needs_healthcare_directive', v_needs_healthcare_directive,
    'needs_ilit',                 v_needs_ilit,
    'needs_bypass_trust',         v_needs_bypass_trust,
    'needs_gifting_strategy',     v_needs_gifting_strategy,
    'has_life_insurance',         v_has_life_insurance,
    'life_insurance_value',       v_life_insurance_value,
    'has_business_interests',     v_has_business,
    'recommendations',            v_rec_list
  );

  INSERT INTO estate_recommendations (
    household_id, owner_id, tax_year,
    needs_will, needs_trust, needs_pour_over_will,
    needs_dpoa, needs_healthcare_directive,
    needs_ilit, needs_bypass_trust, needs_gifting_strategy,
    complexity_score, complexity_flag,
    federal_estate_tax_exposure, state_estate_tax_exposure,
    gross_estate, taxable_estate_federal, taxable_estate_state,
    recommendations_json
  ) VALUES (
    p_household_id, v_owner_id, v_tax_year,
    v_needs_will, v_needs_trust, v_needs_pour_over_will,
    v_needs_dpoa, v_needs_healthcare_directive,
    v_needs_ilit, v_needs_bypass_trust, v_needs_gifting_strategy,
    v_complexity_score, v_complexity_flag,
    v_federal_tax, v_state_tax,
    v_gross_estate, v_taxable_federal, v_taxable_state,
    v_recommendations
  );

  RETURN v_recommendations;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
