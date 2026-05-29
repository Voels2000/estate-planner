-- ============================================================
-- Migration: 20260629120000_rpc_household_access_guards
-- Guard SECURITY DEFINER household RPCs with caller access checks.
-- service_role (recompute cron) bypasses; authenticated must be owner,
-- connected advisor, or connected attorney.
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_household_caller_access(p_household_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = p_household_id
      AND h.owner_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.advisor_clients ac
    INNER JOIN public.households h ON h.owner_id = ac.client_id
    WHERE h.id = p_household_id
      AND ac.advisor_id = auth.uid()
      AND ac.status = ANY (ARRAY['active'::text, 'accepted'::text])
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.attorney_clients ac
    INNER JOIN public.attorney_listings al ON al.id = ac.attorney_id
    WHERE ac.client_id = p_household_id
      AND al.profile_id = auth.uid()
      AND ac.status = ANY (ARRAY['active'::text, 'accepted'::text])
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.assert_household_caller_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_household_caller_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_household_caller_access(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_gifting_summary(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household households%rowtype;
  v_tax_year int := extract(year from now())::int;

  v_annual_exclusion numeric := 19000;
  v_exemption_per_person numeric := 13990000;
  v_total_exemption numeric := 13990000;
  v_tcja_in_effect boolean := true;

  v_split_elected boolean := false;
  v_per_recipient_limit numeric := 19000;

  v_distinct_annual_recipients int := 0;
  v_annual_capacity numeric := 0;
  v_annual_used numeric := 0;
  v_annual_overflow numeric := 0;
  v_annual_remaining numeric := 0;
  v_annual_used_pct numeric := 0;

  v_lifetime_explicit_used numeric := 0;
  v_lifetime_exemption_used numeric := 0;
  v_lifetime_exemption_remaining numeric := 0;
  v_lifetime_used_pct numeric := 0;

  v_gifts jsonb := '[]'::jsonb;
  v_annual_by_recipient jsonb := '[]'::jsonb;
  v_recommendations jsonb := '[]'::jsonb;
  v_gross_estate numeric := 0;
begin
  perform public.assert_household_caller_access(p_household_id);
  select *
  into v_household
  from households
  where id = p_household_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'Household not found',
      'tax_year', v_tax_year
    );
  end if;

  -- Prefer active federal config values when present.
  begin
    select
      coalesce(annual_gift_exclusion, v_annual_exclusion),
      coalesce(
        case
          when coalesce(v_household.filing_status, '') in ('mfj', 'married_filing_jointly', 'married_joint')
            then estate_exemption_married
          else estate_exemption_individual
        end,
        v_total_exemption
      ),
      coalesce(estate_exemption_individual, v_exemption_per_person)
    into
      v_annual_exclusion,
      v_total_exemption,
      v_exemption_per_person
    from federal_tax_config
    where is_active = true
    order by updated_at desc nulls last
    limit 1;
  exception
    when undefined_table then
      null;
  end;

  -- Fix 1: split-gift detection from annual gift rows with Form 709 filed.
  select exists (
    select 1
    from gift_history gh
    where gh.household_id = p_household_id
      and gh.tax_year = v_tax_year
      and gh.gift_type = 'annual'
      and gh.form_709_filed = true
  )
  into v_split_elected;

  v_per_recipient_limit := case
    when coalesce(v_household.filing_status, '') = 'mfj' and v_split_elected then v_annual_exclusion * 2
    else v_annual_exclusion
  end;

  select count(*)
  into v_distinct_annual_recipients
  from (
    select coalesce(nullif(trim(recipient_name), ''), 'Unnamed recipient') as recipient_name
    from gift_history
    where household_id = p_household_id
      and tax_year = v_tax_year
      and gift_type = 'annual'
    group by 1
  ) r;

  -- Fix 2 + 3: annual used is per-recipient capped sum; overflow rolls to lifetime.
  select
    coalesce(sum(least(recipient_total, v_per_recipient_limit)), 0),
    coalesce(sum(greatest(0, recipient_total - v_per_recipient_limit)), 0)
  into v_annual_used, v_annual_overflow
  from (
    select sum(amount)::numeric as recipient_total
    from gift_history
    where household_id = p_household_id
      and tax_year = v_tax_year
      and gift_type = 'annual'
    group by coalesce(nullif(trim(recipient_name), ''), 'Unnamed recipient')
  ) sub;

  -- Fix 4: annual capacity uses per-recipient limit and actual recipient count.
  v_annual_capacity := v_per_recipient_limit * v_distinct_annual_recipients;
  v_annual_remaining := greatest(0, v_annual_capacity - v_annual_used);
  v_annual_used_pct := case
    when v_annual_capacity > 0 then round((v_annual_used / v_annual_capacity) * 100, 2)
    else 0
  end;

  select coalesce(sum(amount), 0)
  into v_lifetime_explicit_used
  from gift_history
  where household_id = p_household_id
    and gift_type = 'lifetime';

  -- Overflow above annual limits is treated as lifetime exemption usage.
  v_lifetime_exemption_used := v_lifetime_explicit_used + v_annual_overflow;
  v_lifetime_exemption_remaining := greatest(0, v_total_exemption - v_lifetime_exemption_used);
  v_lifetime_used_pct := case
    when v_total_exemption > 0 then round((v_lifetime_exemption_used / v_total_exemption) * 100, 4)
    else 0
  end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', gh.id,
        'tax_year', gh.tax_year,
        'donor_person', gh.donor_person,
        'recipient_name', gh.recipient_name,
        'recipient_relationship', gh.recipient_relationship,
        'amount', gh.amount,
        'gift_type', gh.gift_type,
        'form_709_filed', gh.form_709_filed,
        'notes', gh.notes,
        'created_at', gh.created_at
      )
      order by gh.tax_year desc, gh.created_at desc
    ),
    '[]'::jsonb
  )
  into v_gifts
  from gift_history gh
  where gh.household_id = p_household_id;

  -- Fix 4: annual_by_recipient uses per-recipient limit for remaining calc.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recipient_name', recipient_name,
        'total_gifted', recipient_total,
        'annual_exclusion_used', least(recipient_total, v_per_recipient_limit),
        'annual_exclusion_remaining', greatest(0, v_per_recipient_limit - recipient_total),
        'overflow_to_lifetime', greatest(0, recipient_total - v_per_recipient_limit)
      )
      order by recipient_total desc
    ),
    '[]'::jsonb
  )
  into v_annual_by_recipient
  from (
    select
      coalesce(nullif(trim(recipient_name), ''), 'Unnamed recipient') as recipient_name,
      sum(amount)::numeric as recipient_total
    from gift_history
    where household_id = p_household_id
      and tax_year = v_tax_year
      and gift_type = 'annual'
    group by 1
  ) r;

  -- Keep key present for clients expecting recommendations list.
  v_recommendations := '[]'::jsonb;

  -- Approximate gross estate from live balance-sheet inputs.
  select
    coalesce((select sum(a.value) from assets a where a.owner_id = v_household.owner_id), 0)
    + coalesce((select sum(re.current_value) from real_estate re where re.owner_id = v_household.owner_id), 0)
    - coalesce((select sum(l.balance) from liabilities l where l.owner_id = v_household.owner_id), 0)
  into v_gross_estate;

  return jsonb_build_object(
    'success', true,
    'tax_year', v_tax_year,
    'filing_status', coalesce(v_household.filing_status, 'single'),
    'exemption_per_person', v_exemption_per_person,
    'total_exemption', v_total_exemption,
    'lifetime_exemption_used', v_lifetime_exemption_used,
    'lifetime_exemption_remaining', v_lifetime_exemption_remaining,
    'lifetime_used_pct', v_lifetime_used_pct,
    'annual_exclusion', v_annual_exclusion,
    'split_elected', v_split_elected,
    'annual_capacity', v_annual_capacity,
    'annual_used', v_annual_used,
    'annual_remaining', v_annual_remaining,
    'annual_used_pct', v_annual_used_pct,
    'annual_overflow_to_lifetime', v_annual_overflow,
    'tcja_in_effect', v_tcja_in_effect,
    'gifts', v_gifts,
    'annual_by_recipient', v_annual_by_recipient,
    'recommendations', v_recommendations,
    'gross_estate', v_gross_estate
  );
end;
$$;

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
  PERFORM public.assert_household_caller_access(p_household_id);
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
  PERFORM public.assert_household_caller_access(p_household_id);
  SELECT * INTO v_household FROM households WHERE id = p_household_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_owner_id  := v_household.owner_id;
  v_admin_pct := COALESCE(v_household.admin_expense_pct, 0.02);
  v_state_code := UPPER(TRIM(COALESCE(v_household.state_primary, '')));
  v_is_mfj    := v_household.filing_status = 'mfj';

  -- Financial assets
  SELECT
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' THEN value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' AND liquidity = 'liquid'   THEN value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included' AND liquidity = 'illiquid' THEN value ELSE 0 END), 0)
  INTO v_inside_financial, v_inside_liquid, v_inside_illiquid
  FROM assets WHERE owner_id = v_owner_id;

  -- Outside structure
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

  -- Real estate (gross FMV — correct for IRS estate tax purposes)
  SELECT COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included'
    THEN current_value ELSE 0 END), 0)
  INTO v_inside_re FROM real_estate WHERE owner_id = v_owner_id;

  -- Businesses — weighted by ownership_pct
  SELECT COALESCE(SUM(CASE WHEN estate_inclusion_status = 'included'
    THEN estimated_value * (COALESCE(ownership_pct, 100) / 100.0)
    ELSE 0 END), 0)
  INTO v_inside_business FROM businesses WHERE owner_id = v_owner_id;

  -- DLOC/DLOM discount — weighted by ownership_pct
  SELECT COALESCE(SUM(
    CASE WHEN estate_inclusion_status = 'included'
    THEN estimated_value * (COALESCE(ownership_pct, 100) / 100.0)
      * (1 - (1 - COALESCE(dloc_pct, 0)) * (1 - COALESCE(dlom_pct, 0)))
    ELSE 0 END
  ), 0)
  INTO v_dloc_dlom_disc FROM businesses WHERE owner_id = v_owner_id;

  -- Insurance: life insurance only
  SELECT COALESCE(SUM(
    CASE WHEN policy_subtype IN ('term','whole','universal','variable')
      AND death_benefit IS NOT NULL
    THEN death_benefit ELSE 0 END
  ), 0)
  INTO v_inside_insurance
  FROM insurance_policies WHERE user_id = v_owner_id;

  -- Liabilities + mortgages
  SELECT COALESCE(SUM(balance), 0)
  INTO v_liabilities FROM liabilities WHERE owner_id = v_owner_id;

  SELECT COALESCE(SUM(mortgage_balance), 0)
  INTO v_mortgage_total
  FROM real_estate
  WHERE owner_id = v_owner_id
    AND estate_inclusion_status = 'included'
    AND mortgage_balance IS NOT NULL;

  v_liabilities := v_liabilities + v_mortgage_total;

  -- Strategy line items
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

  -- Totals
  v_inside_total   := v_inside_financial + v_inside_re + v_inside_business + v_inside_insurance;
  v_gross_estate   := v_inside_total + v_outside_struct;
  v_net_estate     := v_gross_estate - v_liabilities;
  v_admin_expense  := v_gross_estate * v_admin_pct;
  v_taxable_estate := GREATEST(0,
    v_net_estate - v_admin_expense - v_dloc_dlom_disc - v_outside_strategy
  );

  -- Federal tax
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

  -- Reduce federal exemption by lifetime gifts already used (Form 709 history)
  v_exemption := GREATEST(0, v_exemption - p_lifetime_gifts_used);
  v_exemption_used        := LEAST(v_taxable_estate, v_exemption);
  v_exemption_remain      := GREATEST(0, v_exemption - v_taxable_estate);
  v_estimated_tax_federal := GREATEST(0, (v_taxable_estate - v_exemption) * v_tax_rate);

  -- State estate tax
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
        v_state_taxable_cst := GREATEST(0, v_gross_estate - (v_state_exemption * 2));

        IF v_state_code = 'NY' AND v_gross_estate > (v_state_exemption * 2) * 1.05 THEN
          v_state_taxable_cst := v_gross_estate;
        ELSE
          v_state_taxable_cst := GREATEST(0, v_gross_estate - (v_state_exemption * 2));
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
    'source_role',                p_source_role
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_estate_composition(uuid, text, numeric) TO service_role;