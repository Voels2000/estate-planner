drop function if exists public.calculate_gifting_summary(uuid);

create function public.calculate_gifting_summary(p_household_id uuid)
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
