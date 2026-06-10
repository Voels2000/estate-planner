-- State estate tax public content (learn pages) — separate from Engine B calculation tables

CREATE TABLE IF NOT EXISTS public.state_estate_tax_content (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code               text NOT NULL UNIQUE,
  state_name               text NOT NULL,
  exemption_amount         numeric NOT NULL,
  exemption_indexed        boolean NOT NULL DEFAULT false,
  top_rate_pct             numeric NOT NULL,
  portability              boolean NOT NULL DEFAULT false,
  has_cliff_effect         boolean NOT NULL DEFAULT false,
  law_effective_date       date NOT NULL,
  last_reviewed            date NOT NULL,
  review_notes             text,
  brackets                 jsonb NOT NULL,
  quirks                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  scenario_estate_value    numeric,
  scenario_tax_no_plan     numeric,
  scenario_tax_with_plan   numeric,
  scenario_notes           text,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               text
);

ALTER TABLE public.state_estate_tax_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read state_estate_tax_content"
  ON public.state_estate_tax_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role full access state_estate_tax_content"
  ON public.state_estate_tax_content FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_state_estate_tax_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_state_estate_tax_content_updated_at
  BEFORE UPDATE ON public.state_estate_tax_content
  FOR EACH ROW EXECUTE FUNCTION update_state_estate_tax_content_updated_at();

GRANT SELECT ON TABLE public.state_estate_tax_content TO anon, authenticated;
GRANT ALL ON TABLE public.state_estate_tax_content TO service_role;

-- Seed 13 estate-tax states (idempotent)
INSERT INTO public.state_estate_tax_content (
  state_code, state_name, exemption_amount, exemption_indexed, top_rate_pct,
  portability, has_cliff_effect, law_effective_date, last_reviewed,
  brackets, quirks,
  scenario_estate_value, scenario_tax_no_plan, scenario_tax_with_plan, scenario_notes
) VALUES
(
  'WA', 'Washington', 3000000, false, 20, false, false, '2026-07-01', '2026-06-01',
  '[
    {"min": 0, "max": 1000000, "rate_pct": 10, "base_tax": 0},
    {"min": 1000000, "max": 2000000, "rate_pct": 14, "base_tax": 100000},
    {"min": 2000000, "max": 3000000, "rate_pct": 15, "base_tax": 240000},
    {"min": 3000000, "max": 4000000, "rate_pct": 16, "base_tax": 390000},
    {"min": 4000000, "max": 6000000, "rate_pct": 18, "base_tax": 550000},
    {"min": 6000000, "max": 9000000, "rate_pct": 19, "base_tax": 910000},
    {"min": 9000000, "max": null, "rate_pct": 20, "base_tax": 1480000}
  ]'::jsonb,
  '[
    {"label": "No portability", "description": "Washington does not allow a surviving spouse to use the deceased spouse''s unused exemption."},
    {"label": "Frozen exemption", "description": "The $3M exemption is not indexed to inflation going forward (ESB 6347, 2026)."},
    {"label": "Split 2026 year", "description": "Deaths before July 1, 2026 used a higher temporary exemption and top rate — plans drafted in early 2026 may need review."}
  ]'::jsonb,
  6000000, 390000, 0,
  'A married Bellevue couple with a $6M estate (home, investments, rental). Without a bypass trust, the second death exposes the full estate to a single $3M exemption.'
),
(
  'OR', 'Oregon', 1000000, false, 16, false, false, '2012-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 500000, "rate_pct": 10, "base_tax": 0},
    {"min": 500000, "max": 1000000, "rate_pct": 10.25, "base_tax": 50000},
    {"min": 1000000, "max": 1500000, "rate_pct": 11, "base_tax": 101250},
    {"min": 1500000, "max": 2500000, "rate_pct": 15, "base_tax": 156250},
    {"min": 2500000, "max": null, "rate_pct": 16, "base_tax": 306250}
  ]'::jsonb,
  '[
    {"label": "Low exemption threshold", "description": "Oregon''s $1M exemption is among the lowest of any state with an estate tax — many Portland-area homeowners exceed it without feeling wealthy."},
    {"label": "No portability", "description": "Oregon does not offer spousal portability; both exemptions must be used via trust planning."},
    {"label": "Separate from inheritance tax", "description": "Oregon has no inheritance tax, but the estate tax applies to the full gross estate before distributions."}
  ]'::jsonb,
  3000000, 272000, 0,
  'A married couple with a $3M Portland-area estate. With only one $1M exemption at the second death, roughly $2M is taxable — a six-figure Oregon bill that bypass trust planning can eliminate.'
),
(
  'MA', 'Massachusetts', 2000000, false, 16, false, true, '2023-01-01', '2026-06-01',
  '[
    {"min": 0, "max": null, "rate_pct": 16, "base_tax": 0}
  ]'::jsonb,
  '[
    {"label": "Cliff effect", "description": "Estates above $2M are taxed on the entire estate value, not just the amount over the exemption — a modest overage can trigger tax on millions."},
    {"label": "No portability", "description": "Massachusetts does not allow portability of the unused exemption to a surviving spouse."},
    {"label": "High home values", "description": "Greater Boston real estate alone pushes many households over the cliff threshold."}
  ]'::jsonb,
  4000000, 640000, 0,
  'A $4M estate modestly above the $2M cliff. Without planning, Massachusetts taxes the entire $4M at graduated rates up to 16% — not just the $2M excess.'
),
(
  'MD', 'Maryland', 5000000, false, 16, false, false, '2019-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 50000, "rate_pct": 0.8, "base_tax": 0},
    {"min": 50000, "max": 100000, "rate_pct": 1.6, "base_tax": 400},
    {"min": 100000, "max": 500000, "rate_pct": 2.4, "base_tax": 1200},
    {"min": 500000, "max": 1000000, "rate_pct": 3.2, "base_tax": 10800},
    {"min": 1000000, "max": 2000000, "rate_pct": 4.4, "base_tax": 26800},
    {"min": 2000000, "max": 3000000, "rate_pct": 5.6, "base_tax": 70800},
    {"min": 3000000, "max": 4000000, "rate_pct": 6.4, "base_tax": 126800},
    {"min": 4000000, "max": 5000000, "rate_pct": 7.2, "base_tax": 190800},
    {"min": 5000000, "max": null, "rate_pct": 16, "base_tax": 262800}
  ]'::jsonb,
  '[
    {"label": "Dual tax system", "description": "Maryland is one of few states with both an estate tax and a separate inheritance tax (10% on certain non-lineal heirs)."},
    {"label": "No portability", "description": "Unused exemption cannot be transferred to a surviving spouse without trust planning."}
  ]'::jsonb,
  8000000, 485000, 0,
  'A married couple with an $8M estate. Without preserving both $5M exemptions via a bypass trust, the second death can leave a substantial Maryland estate tax bill.'
),
(
  'IL', 'Illinois', 4000000, false, 16, false, false, '2013-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 50000, "rate_pct": 0.8, "base_tax": 0},
    {"min": 50000, "max": 100000, "rate_pct": 1.6, "base_tax": 400},
    {"min": 100000, "max": 500000, "rate_pct": 2.4, "base_tax": 1200},
    {"min": 500000, "max": 1000000, "rate_pct": 3.2, "base_tax": 10800},
    {"min": 1000000, "max": 2000000, "rate_pct": 4.4, "base_tax": 26800},
    {"min": 2000000, "max": 3000000, "rate_pct": 5.6, "base_tax": 70800},
    {"min": 3000000, "max": 4000000, "rate_pct": 6.4, "base_tax": 126800},
    {"min": 4000000, "max": null, "rate_pct": 16, "base_tax": 190800}
  ]'::jsonb,
  '[
    {"label": "Frozen exemption", "description": "Illinois''s $4M exemption has not been indexed to inflation since 2013."},
    {"label": "No portability", "description": "Both spouses'' exemptions require credit shelter trust planning to be fully used."}
  ]'::jsonb,
  8000000, 625000, 0,
  'An $8M Illinois estate without bypass trust planning at the first death can leave only one $4M exemption at the survivor''s death.'
),
(
  'MN', 'Minnesota', 3000000, true, 16, false, false, '2023-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 1000000, "rate_pct": 13, "base_tax": 0},
    {"min": 1000000, "max": 2000000, "rate_pct": 14, "base_tax": 130000},
    {"min": 2000000, "max": 3000000, "rate_pct": 15, "base_tax": 270000},
    {"min": 3000000, "max": null, "rate_pct": 16, "base_tax": 420000}
  ]'::jsonb,
  '[
    {"label": "Indexed exemption", "description": "Minnesota adjusts its exemption annually for inflation."},
    {"label": "No portability", "description": "Trust planning is required to use both spouses'' exemptions."}
  ]'::jsonb,
  6000000, 420000, 0,
  'A $6M Minnesota married couple. Without a bypass trust, the second death taxes the full estate against a single indexed exemption.'
),
(
  'NY', 'New York', 7161000, true, 16, false, true, '2024-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 500000, "rate_pct": 3.06, "base_tax": 0},
    {"min": 500000, "max": 1000000, "rate_pct": 5.0, "base_tax": 15300},
    {"min": 1000000, "max": 2000000, "rate_pct": 8.0, "base_tax": 40300},
    {"min": 2000000, "max": 3000000, "rate_pct": 10.5, "base_tax": 120300},
    {"min": 3000000, "max": 5000000, "rate_pct": 12.0, "base_tax": 225300},
    {"min": 5000000, "max": null, "rate_pct": 16, "base_tax": 465300}
  ]'::jsonb,
  '[
    {"label": "Cliff effect", "description": "If the taxable estate exceeds 105% of the exemption ($7.51M in 2024), New York taxes the entire estate — not just the excess."},
    {"label": "Indexed exemption", "description": "The exemption adjusts annually; verify the current-year amount before planning."},
    {"label": "No portability", "description": "New York does not offer federal-style portability."}
  ]'::jsonb,
  15000000, 1650000, 0,
  'A $15M New York estate triggers the cliff — the entire estate is taxed, not just the amount above the ~$7.16M exemption.'
),
(
  'CT', 'Connecticut', 13610000, true, 12, false, false, '2023-01-01', '2026-06-01',
  '[
    {"min": 0, "max": null, "rate_pct": 12, "base_tax": 0}
  ]'::jsonb,
  '[
    {"label": "Federal-aligned exemption", "description": "Connecticut''s exemption is pegged to the federal estate tax exemption (with a state-specific phase-in schedule)."},
    {"label": "Gift tax overlap", "description": "Connecticut is the only state with its own gift tax — lifetime gifts can affect the estate tax calculation."}
  ]'::jsonb,
  20000000, 765000, 0,
  'A $20M Connecticut estate still faces state tax above the ~$13.6M exemption — federal exemption alignment does not eliminate state exposure for larger estates.'
),
(
  'ME', 'Maine', 6800000, true, 12, false, false, '2022-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 3000000, "rate_pct": 8, "base_tax": 0},
    {"min": 3000000, "max": 5500000, "rate_pct": 10, "base_tax": 240000},
    {"min": 5500000, "max": null, "rate_pct": 12, "base_tax": 490000}
  ]'::jsonb,
  '[
    {"label": "Indexed exemption", "description": "Maine adjusts its exemption annually for inflation."},
    {"label": "No portability", "description": "Credit shelter trust planning is needed to preserve both exemptions."}
  ]'::jsonb,
  12000000, 550000, 0,
  'A $12M Maine estate without trust planning can forfeit one spouse''s indexed exemption at the second death.'
),
(
  'RI', 'Rhode Island', 1774583, true, 16, false, false, '2025-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 50000, "rate_pct": 0.8, "base_tax": 0},
    {"min": 50000, "max": 100000, "rate_pct": 1.6, "base_tax": 400},
    {"min": 100000, "max": 500000, "rate_pct": 2.4, "base_tax": 1200},
    {"min": 500000, "max": 1000000, "rate_pct": 3.2, "base_tax": 10800},
    {"min": 1000000, "max": 1500000, "rate_pct": 4.4, "base_tax": 26800},
    {"min": 1500000, "max": null, "rate_pct": 16, "base_tax": 48800}
  ]'::jsonb,
  '[
    {"label": "Low indexed exemption", "description": "Rhode Island''s exemption is indexed but remains under $2M — coastal property values push many residents over the threshold."},
    {"label": "No portability", "description": "Both exemptions require trust-based planning."}
  ]'::jsonb,
  4000000, 365000, 0,
  'A $4M Rhode Island estate with a single exemption at the second death leaves roughly $2.2M taxable.'
),
(
  'VT', 'Vermont', 5000000, false, 16, false, false, '2011-01-01', '2026-06-01',
  '[
    {"min": 0, "max": null, "rate_pct": 16, "base_tax": 0}
  ]'::jsonb,
  '[
    {"label": "Flat top rate", "description": "Vermont applies a flat 16% rate on the entire taxable estate above the exemption."},
    {"label": "Frozen exemption", "description": "The $5M exemption has not been indexed to inflation."}
  ]'::jsonb,
  10000000, 800000, 0,
  'A $10M Vermont estate without bypass trust planning uses only one $5M exemption at the second death — $5M taxed at 16%.'
),
(
  'HI', 'Hawaii', 5490000, true, 20, true, false, '2020-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 1000000, "rate_pct": 10, "base_tax": 0},
    {"min": 1000000, "max": 2000000, "rate_pct": 11, "base_tax": 100000},
    {"min": 2000000, "max": 3000000, "rate_pct": 12, "base_tax": 210000},
    {"min": 3000000, "max": 4000000, "rate_pct": 13, "base_tax": 330000},
    {"min": 4000000, "max": 5000000, "rate_pct": 14, "base_tax": 460000},
    {"min": 5000000, "max": null, "rate_pct": 20, "base_tax": 600000}
  ]'::jsonb,
  '[
    {"label": "Portability available", "description": "Hawaii is one of few states allowing a surviving spouse to elect to use the deceased spouse''s unused exemption — but an election must be filed timely."},
    {"label": "Indexed exemption", "description": "Hawaii adjusts its exemption annually for inflation."}
  ]'::jsonb,
  11000000, 1100000, 0,
  'An $11M Hawaii estate without using portability or a bypass trust can leave substantial tax at the second death despite Hawaii''s portability option.'
),
(
  'DC', 'District of Columbia', 4528800, true, 16, false, false, '2021-01-01', '2026-06-01',
  '[
    {"min": 0, "max": 1000000, "rate_pct": 11.2, "base_tax": 0},
    {"min": 1000000, "max": 2000000, "rate_pct": 12.0, "base_tax": 112000},
    {"min": 2000000, "max": 3000000, "rate_pct": 12.8, "base_tax": 232000},
    {"min": 3000000, "max": 4000000, "rate_pct": 13.6, "base_tax": 360000},
    {"min": 4000000, "max": 5000000, "rate_pct": 14.4, "base_tax": 496000},
    {"min": 5000000, "max": null, "rate_pct": 16, "base_tax": 640000}
  ]'::jsonb,
  '[
    {"label": "Indexed exemption", "description": "DC adjusts its estate tax exemption annually for inflation."},
    {"label": "No portability", "description": "Trust planning is required to use both spouses'' exemptions."},
    {"label": "High local property values", "description": "DC metro real estate alone can push federal-exemption-comfortable households into DC estate tax territory."}
  ]'::jsonb,
  9000000, 715000, 0,
  'A $9M DC-area estate without bypass trust planning can forfeit one indexed exemption at the second death.'
)
ON CONFLICT (state_code) DO NOTHING;
