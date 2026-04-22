-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: calculate_estate_composition RPC
-- Session 27 / Sprint 85
-- Returns full inside/outside classification with liquid/illiquid breakdown.
-- Called by /api/estate-composition route -> EstateCompositionCard component.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.calculate_estate_composition(uuid);

create function public.calculate_estate_composition(p_household_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household               households%rowtype;
  v_exemption_individual    numeric := 15000000;
  v_exemption_married       numeric := 30000000;
  v_exemption_available     numeric := 15000000;
  v_inside_financial        numeric := 0;
  v_inside_financial_liquid numeric := 0;
  v_inside_financial_illiquid numeric := 0;
  v_inside_real_estate      numeric := 0;
  v_inside_business_gross   numeric := 0;
  v_inside_business_taxable numeric := 0;
  v_inside_insurance        numeric := 0;
  v_inside_total            numeric := 0;
  v_inside_liquid           numeric := 0;
  v_inside_illiquid         numeric := 0;
  v_outside_structure_total numeric := 0;
  v_outside_structure_items jsonb   := '[]'::jsonb;
  v_outside_strategy_total  numeric := 0;
  v_outside_strategy_items  jsonb   := '[]'::jsonb;
  v_gross_estate            numeric := 0;
  v_total_liabilities       numeric := 0;
  v_net_estate              numeric := 0;
  v_admin_expense           numeric := 0;
  v_marital_deduction       numeric := 0;
  v_adjusted_taxable_gifts  numeric := 0;
  v_valuation_discount_total numeric := 0;
  v_taxable_estate          numeric := 0;
  v_exemption_remaining     numeric := 0;
  v_estimated_tax           numeric := 0;
  v_asset_rec               record;
  v_combined_discount       numeric;
  v_owner_id                uuid;
begin
  -- 1. Load household
  select * into v_household
  from households
  where id = p_household_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Household not found');
  end if;

  v_owner_id := v_household.owner_id;

  -- 2. Load exemption from federal_tax_config
  begin
    select
      coalesce(estate_exemption_individual, 15000000),
      coalesce(estate_exemption_married,    30000000)
    into v_exemption_individual, v_exemption_married
    from federal_tax_config
    where is_active = true
    order by updated_at desc nulls last
    limit 1;
  exception
    when undefined_table then null;
  end;

  v_exemption_available := case
    when coalesce(v_household.filing_status, '') in ('mfj', 'married_filing_jointly', 'married_joint')
         and coalesce(v_household.has_spouse, false)
      then v_exemption_married
    else v_exemption_individual
  end;

  -- 3. Financial assets — split by inclusion status and liquidity
  for v_asset_rec in
    select
      a.id,
      a.name,
      a.value,
      a.asset_type,
      a.estate_inclusion_status,
      case
        when lower(coalesce(a.asset_type, '')) in (
          'cash', 'savings', 'checking', 'money_market', 'cd',
          'brokerage', 'etf', 'stocks', 'bonds', 'mutual_fund',
          'roth_ira', 'traditional_ira', 'roth_401k', 'traditional_401k',
          'sep_ira', 'simple_ira', '403b', '457b'
        ) then true
        else false
      end as is_liquid
    from assets a
    where a.owner_id = v_owner_id
  loop
    if v_asset_rec.estate_inclusion_status = 'included' then
      v_inside_financial := v_inside_financial + coalesce(v_asset_rec.value, 0);
      if v_asset_rec.is_liquid then
        v_inside_financial_liquid := v_inside_financial_liquid + coalesce(v_asset_rec.value, 0);
      else
        v_inside_financial_illiquid := v_inside_financial_illiquid + coalesce(v_asset_rec.value, 0);
      end if;
    else
      v_outside_structure_total := v_outside_structure_total + coalesce(v_asset_rec.value, 0);
      v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
        'name',           v_asset_rec.name,
        'value',          v_asset_rec.value,
        'asset_class',    'financial',
        'exclusion_type', v_asset_rec.estate_inclusion_status
      );
    end if;
  end loop;

  -- 4. Real estate — always illiquid
  for v_asset_rec in
    select re.id, re.property_name, re.current_value, re.estate_inclusion_status
    from real_estate re
    where re.owner_id = v_owner_id
  loop
    if v_asset_rec.estate_inclusion_status = 'included' then
      v_inside_real_estate := v_inside_real_estate + coalesce(v_asset_rec.current_value, 0);
    else
      v_outside_structure_total := v_outside_structure_total + coalesce(v_asset_rec.current_value, 0);
      v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
        'name',           v_asset_rec.property_name,
        'value',          v_asset_rec.current_value,
        'asset_class',    'real_estate',
        'exclusion_type', v_asset_rec.estate_inclusion_status
      );
    end if;
  end loop;

  -- 5. Businesses — apply multiplicative DLOC/DLOM to taxable value
  for v_asset_rec in
    select
      b.id, b.business_name, b.estimated_value,
      b.ownership_pct, b.dloc_pct, b.dlom_pct, b.estate_inclusion_status
    from businesses b
    where b.owner_id = v_owner_id
  loop
    declare
      v_ownership_value numeric;
    begin
      v_ownership_value := coalesce(v_asset_rec.estimated_value, 0)
                         * coalesce(v_asset_rec.ownership_pct, 100) / 100.0;
      if v_asset_rec.estate_inclusion_status = 'included' then
        v_inside_business_gross := v_inside_business_gross + v_ownership_value;
        -- Multiplicative discount: combined = 1 - (1-dloc) * (1-dlom)
        v_combined_discount := 1.0
          - (1.0 - coalesce(v_asset_rec.dloc_pct, 0))
          * (1.0 - coalesce(v_asset_rec.dlom_pct, 0));
        v_inside_business_taxable := v_inside_business_taxable
          + (v_ownership_value * (1.0 - v_combined_discount));
        v_valuation_discount_total := v_valuation_discount_total
          + (v_ownership_value * v_combined_discount);
      else
        v_outside_structure_total := v_outside_structure_total + v_ownership_value;
        v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
          'name',           v_asset_rec.business_name,
          'value',          v_ownership_value,
          'asset_class',    'business',
          'exclusion_type', v_asset_rec.estate_inclusion_status
        );
      end if;
    end;
  end loop;

  -- 6. Insurance — death benefit; excluded when ILIT complete
  for v_asset_rec in
    select ip.id, ip.policy_name, ip.death_benefit, ip.estate_inclusion_status
    from insurance_policies ip
    where ip.owner_id = v_owner_id
  loop
    if v_asset_rec.estate_inclusion_status = 'included' then
      v_inside_insurance := v_inside_insurance + coalesce(v_asset_rec.death_benefit, 0);
    else
      v_outside_structure_total := v_outside_structure_total + coalesce(v_asset_rec.death_benefit, 0);
      v_outside_structure_items := v_outside_structure_items || jsonb_build_object(
        'name',           v_asset_rec.policy_name,
        'value',          v_asset_rec.death_benefit,
        'asset_class',    'insurance',
        'exclusion_type', v_asset_rec.estate_inclusion_status
      );
    end if;
  end loop;

  -- 7. Inside totals
  v_inside_total    := v_inside_financial + v_inside_real_estate
                     + v_inside_business_gross + v_inside_insurance;
  v_inside_liquid   := v_inside_financial_liquid + v_inside_insurance;
  v_inside_illiquid := v_inside_financial_illiquid + v_inside_real_estate
                     + v_inside_business_gross;

  -- 8. Gross estate
  v_gross_estate := v_inside_total;

  -- 9. Liabilities — non-mortgage debt + mortgage balances from real_estate
  select coalesce(sum(l.balance), 0)
  into v_total_liabilities
  from liabilities l
  where l.owner_id = v_owner_id;

  select v_total_liabilities
       + coalesce(
           (select sum(re.mortgage_balance)
            from real_estate re
            where re.owner_id = v_owner_id
              and re.estate_inclusion_status = 'included'
              and re.mortgage_balance is not null),
           0)
  into v_total_liabilities;

  v_net_estate := v_gross_estate - v_total_liabilities;

  -- 10. Admin expense deduction
  v_admin_expense := v_gross_estate * coalesce(v_household.admin_expense_pct, 0.02);

  -- 11. Marital deduction — informational, full gross at first death for MFJ
  v_marital_deduction := case
    when coalesce(v_household.filing_status, '') in ('mfj', 'married_filing_jointly', 'married_joint')
         and coalesce(v_household.has_spouse, false)
      then v_gross_estate
    else 0
  end;

  -- 12. Adjusted Taxable Gifts (post-1976, excluding 3-year clawback gifts)
  select coalesce(sum(atg.amount), 0)
  into v_adjusted_taxable_gifts
  from adjusted_taxable_gifts atg
  where atg.household_id        = p_household_id
    and atg.three_year_clawback = false;

  -- 13. Strategy line items — active current-snapshot reductions
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'strategy_source',  sli.strategy_source,
        'category',         sli.category,
        'amount',           sli.amount,
        'confidence_level', sli.confidence_level,
        'effective_year',   sli.effective_year,
        'metadata',         sli.metadata
      )
      order by sli.confidence_level, sli.amount desc
    ),
    '[]'::jsonb
  )
  into v_outside_strategy_items
  from strategy_line_items sli
  where sli.household_id    = p_household_id
    and sli.is_active       = true
    and sli.projection_year is null
    and sli.sign            = -1;

  select coalesce(sum(sli.amount), 0)
  into v_outside_strategy_total
  from strategy_line_items sli
  where sli.household_id    = p_household_id
    and sli.is_active       = true
    and sli.projection_year is null
    and sli.sign            = -1;

  -- 14. Taxable estate
  v_taxable_estate := greatest(0,
      v_gross_estate
    - v_total_liabilities
    - v_admin_expense
    - v_valuation_discount_total
    + v_adjusted_taxable_gifts
  );

  -- 15. Exemption remaining and estimated tax
  v_exemption_remaining := greatest(0, v_exemption_available - v_taxable_estate);
  v_estimated_tax := case
    when v_taxable_estate > v_exemption_available
      then (v_taxable_estate - v_exemption_available) * 0.40
    else 0
  end;

  -- 16. Return
  return jsonb_build_object(
    'success',                    true,
    'filing_status',              coalesce(v_household.filing_status, 'single'),
    'has_spouse',                 coalesce(v_household.has_spouse, false),
    'inside_total',               round(v_inside_total, 2),
    'inside_financial',           round(v_inside_financial, 2),
    'inside_financial_liquid',    round(v_inside_financial_liquid, 2),
    'inside_financial_illiquid',  round(v_inside_financial_illiquid, 2),
    'inside_real_estate',         round(v_inside_real_estate, 2),
    'inside_business_gross',      round(v_inside_business_gross, 2),
    'inside_business_taxable',    round(v_inside_business_taxable, 2),
    'inside_insurance',           round(v_inside_insurance, 2),
    'inside_liquid',              round(v_inside_liquid, 2),
    'inside_illiquid',            round(v_inside_illiquid, 2),
    'outside_structure_total',    round(v_outside_structure_total, 2),
    'outside_structure_items',    v_outside_structure_items,
    'outside_strategy_total',     round(v_outside_strategy_total, 2),
    'outside_strategy_items',     v_outside_strategy_items,
    'gross_estate',               round(v_gross_estate, 2),
    'total_liabilities',          round(v_total_liabilities, 2),
    'net_estate',                 round(v_net_estate, 2),
    'admin_expense',              round(v_admin_expense, 2),
    'admin_expense_pct',          coalesce(v_household.admin_expense_pct, 0.02),
    'valuation_discount_total',   round(v_valuation_discount_total, 2),
    'marital_deduction',          round(v_marital_deduction, 2),
    'adjusted_taxable_gifts',     round(v_adjusted_taxable_gifts, 2),
    'taxable_estate',             round(v_taxable_estate, 2),
    'exemption_available',        round(v_exemption_available, 2),
    'exemption_remaining',        round(v_exemption_remaining, 2),
    'estimated_tax',              round(v_estimated_tax, 2)
  );
end;
$$;
