# B2B2C billing policy — advisors, attorneys, and consumer pay drop

**Canonical pricing + handoff policy** for professional subscriptions, firm seats, and optional consumer billing transfer when a client connects.

**Related:** [LAUNCH_CHECKLIST.md § Stripe](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue) · [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) · [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) · [DECISION_LOG.md](./DECISION_LOG.md)

---

## Three billing layers (do not conflate)

| Layer | Who pays | What it buys | Example |
|-------|----------|--------------|---------|
| **Consumer subscription** | Household | Financial / Retirement / Estate tiers | `$50–200/mo` consumer Stripe |
| **Professional subscription** | Advisor or attorney | Portal access + client caps or firm seats | Advisor firm `$149/seat`; attorney `$99/mo` for 15 clients |
| **Consumer handoff (B2B2C)** | Professional sponsors consumer | Consumer Stripe pauses; managed tier in app | `advisor_managed` → Estate tier free to consumer |

**Client caps (3 / 15 / 50)** on attorney billing = how many **households** one attorney account can serve — **not** team seats.

**Firm seats** = how many **advisor or attorney logins** share one firm subscription — advisor built (`/advisor/firm`); attorney firm multi-seat (L5) not built yet.

---

## Leading practice (market scan)

| Product | Professional pays | Consumer pays when linked | Notes |
|---------|-------------------|---------------------------|-------|
| **eMoney / MGP / Holistiplan** | Firm + per-advisor or per-client license | Typically **no** — advisor-sponsored planning access | Table stakes for RIA B2B2C |
| **Personal Capital for Advisors** | AUM / firm deal | **No** — client dashboard included | Aggregation-first |
| **Clio / WealthCounsel** | Firm per-seat subscription | **No** for client portal — firm pays | Law firm buys seats; clients use portal free |
| **Trust & Will (partner)** | Mixed — attorney partner programs vary | Often **consumer pays** OR bundled in engagement letter | Less automatic handoff |
| **Vanilla / estate doc tools** | Per matter or firm | Usually separate from consumer SaaS | Document-centric |

**Implication for MWM:**

| Persona | Recommended default at go-live | Rationale |
|---------|-------------------------------|-----------|
| **Advisor** | Consumer handoff **ON** (`B2B2C_ADVISOR_CONSUMER_BILLING` default true) | Matches eMoney-class expectation; advisor wants client on full dashboard between meetings |
| **Attorney** | Consumer handoff **OFF** (`B2B2C_ATTORNEY_CONSUMER_BILLING` default false) | Many engagements: client already subscribes OR attorney bills planning in flat fee; turn ON when selling firm-sponsored access |

You can flip either flag in Vercel **without code changes** when a market segment proves out.

---

## Environment toggles (implementation)

Set in Vercel Production (and `.env.local` for local testing):

| Variable | Default | Effect when ON |
|----------|---------|----------------|
| `B2B2C_ADVISOR_CONSUMER_BILLING` | **true** (omit or any value except `false`) | On advisor connect: `advisor_managed`, tier from `B2B2C_ADVISOR_MANAGED_TIER` (default **3**), pause consumer Stripe at period end |
| `B2B2C_ADVISOR_CONSUMER_BILLING=false` | — | Connection works; consumer **keeps** own subscription |
| `B2B2C_ATTORNEY_CONSUMER_BILLING` | **false** | No consumer billing change on attorney connect (current behavior) |
| `B2B2C_ATTORNEY_CONSUMER_BILLING=true` | — | On attorney connect: `attorney_managed`, tier from `B2B2C_ATTORNEY_MANAGED_TIER` (default **2** Retirement), pause Stripe |
| `B2B2C_ADVISOR_MANAGED_TIER` | `3` | Estate tier when advisor handoff ON |
| `B2B2C_ATTORNEY_MANAGED_TIER` | `2` | Retirement tier when attorney handoff ON (lighter than advisor — adjust to `3` if you bundle Estate) |

**Code paths:** `lib/billing/b2b2cBillingPolicy.ts` · `lib/billing/managedConsumerBilling.ts`

**Connection hooks:**

| Role | Connect | Disconnect |
|------|---------|------------|
| Advisor | invite accept, link-pending, accept-request | disconnect-advisor, remove-client |
| Attorney | attorney-invite, grant-access, accept-request, intake complete | revoke-access |

**Stripe webhook:** Skips profile overwrites for `advisor_managed` and `attorney_managed`.

**Migration:** `20260704120000_b2b2c_connection_billing.sql` — billing audit columns on both link tables + `attorney_managed` status.

---

## Pricing matrix — **decide before go-live**

Status: **TBD — fill Stripe Dashboard + env vars on go-live day.** Code references below are placeholders or test IDs.

### Consumer (household) — direct Stripe

| Tier | Includes (summary) | Suggested monthly | Suggested annual | Env vars |
|------|-------------------|-------------------|------------------|----------|
| Financial (1) | Core planning, import | TBD | TBD | `STRIPE_PRICE_FINANCIAL_*` |
| Retirement (2) | + projections, MC | TBD | TBD | `STRIPE_PRICE_RETIREMENT_*` |
| Estate (3) | + strategies, estate tax | TBD | TBD | `STRIPE_PRICE_ESTATE_*` |

See [LAUNCH_CHECKLIST § Stripe Setup](./LAUNCH_CHECKLIST.md#stripe-setup-required-before-public_signup_opentrue).

---

## Competitive pricing benchmarks (2026)

Public list prices and industry estimates — **verify before go-live**; enterprise tools often quote custom. MWM is an **estate-first adjunct** (not a full eMoney/Clio replacement), so target **meaningfully below** full OS pricing while capturing estate-planning value.

### Advisor — per **advisor seat** (firm billing)

| Competitor | Model | Typical $/advisor/mo | Notes |
|------------|-------|----------------------|-------|
| **eMoney Pro/Premier** | Per advisor, annual contract | **~$250–500+** ($3k–6k+/yr) | Full cash-flow + estate + MC; enterprise sales |
| **RightCapital Premium** | Per advisor | **~$150–210** ($1.8k–2.5k/yr) | Transparent retail; planning breadth below eMoney |
| **MoneyGuide / Envestnet** | Per advisor | **~$100–200** | Goals-first; lighter estate |
| **Holistiplan** | Per **household** (not seat) | **~$2.50–4/household/mo** at 30 HH ($75/mo min) | Tax-only; scales with client count |
| **Vanilla / estate doc** | Per firm or matter | **~$200–500/mo** firm | Document-centric, not living dashboard |

**MWM positioning:** Estate collaboration + living household dashboard between meetings — price **below RightCapital**, far below eMoney, with optional consumer handoff included (no per-client Holistiplan-style meter on top of seats).

#### Recommended MWM advisor seat pricing (go-live target)

| Firm tier | Seats | **Recommended $/seat/mo** | Code placeholder today | Rationale |
|-----------|-------|---------------------------|------------------------|-----------|
| **Starter** | 1–10 | **$129–149** | $149 | Solo/small RIA; undercuts RightCapital; matches LAUNCH_CHECKLIST anchor |
| **Growth** | 11–50 | **$99–119** | $99 | Volume discount; LAUNCH_CHECKLIST once cited $349/mo **firm flat** — prefer **per-seat** at this band instead |
| **Enterprise** | 51–250 | **$79–99** | $75 | Negotiated floor; custom above 250 |

**Annual billing:** Offer **~15–20% off** (match Clio/Holistiplan norm). Example: Starter $149/mo → **$1,499/yr** per seat.

**Optional add-on (future):** Per-household surcharge above N active B2B2C clients if you need Holistiplan-like scaling — **not in v1**; consumer handoff covers client access today.

### Attorney — solo account (client **household** caps today)

| Competitor | Model | Typical $/user/mo | Notes |
|------------|-------|-------------------|-------|
| **Clio Essentials** | Per user seat | **$79–89** (annual) | Full PMS + portal — MWM is not PMS |
| **Clio Advanced/Complete** | Per user seat | **$109–149** | Workflows + intake |
| **WealthCounsel / estate platforms** | Firm membership | **$100–300+/mo** | Drafting + research |
| **Trust & Will partner** | Per matter / rev share | Varies | Consumer doc funnel |

**MWM positioning:** Read-only estate intel + vault + intake prep — **adjunct** to Clio, not replacement. Price **below Clio Essentials** for solo; firm **team seats (L5)** priced separately when built.

#### Recommended MWM attorney solo pricing (go-live target)

| Tier | Client cap | **Recommended $/mo** | UI/code today | Rationale |
|------|------------|----------------------|---------------|-----------|
| **Free** | 3 | **$0** | $0 | Trial / directory presence |
| **Starter** | 15 | **$79–99** | $99 | ~1 Clio EasyStart; intake + gaps + PDF |
| **Growth** | 50 | **$199–249** | $249 | Small firm solo power user; branding tier |

#### Recommended MWM attorney **firm seat** pricing (L5 — when built)

Mirror Clio seat bands; collaboration-only tier below Clio, premium tier with intake PDF branding:

| Firm tier | Seats | **Recommended $/seat/mo** | Includes |
|-----------|-------|---------------------------|----------|
| **Starter** | 1–5 attorneys | **$59–79** | Portal + client caps pooled or per-seat |
| **Growth** | 6–15 | **$89–109** | + PDF branding, bulk client mgmt |
| **Enterprise** | 16+ | **$99–129** | Custom; bar-association / volume discounts |

**L5 implementation note:** Reuse advisor `firms` / `firm_members` pattern or attorney-specific firm entity — pricing table above is **policy only** until L5 ships.

---

### MWM go-live recommendation (single line)

| Product | Recommended launch price | Code / env today |
|---------|-------------------------|------------------|
| Advisor Starter seat | **$149/mo** (or $1,499/yr) | `ADVISOR_FIRM_SEAT_RATES.starter = 149` |
| Advisor Growth seat | **$99/mo** | `ADVISOR_FIRM_SEAT_RATES.growth = 99` |
| Advisor Enterprise seat | **$79/mo** | `ADVISOR_FIRM_SEAT_RATES.enterprise = 75` → consider **$79** at go-live |
| Attorney Starter (solo) | **$99/mo** | `ATTORNEY_PLAN_LIMITS.starter` |
| Attorney Growth (solo) | **$249/mo** | `ATTORNEY_PLAN_LIMITS.growth` |

Document final numbers in Stripe live mode + update `lib/tiers.ts` price IDs before `PUBLIC_SIGNUP_OPEN`.

### Advisor firm — per **advisor seat** (team billing)

| Firm tier | Seat range (UI) | Launch target $/seat/mo | Competitive band | Stripe product |
|-----------|------------------|-------------------------|------------------|----------------|
| Starter | 1–10 advisors | **$149** | RightCapital ~$150; eMoney $250+ | `ADVISOR_FIRM_PRICE_IDS.starter` |
| Growth | 11–50 | **$99** | Volume discount | `ADVISOR_FIRM_PRICE_IDS.growth` |
| Enterprise | 51–250 | **$79** (code placeholder $75) | Enterprise floor | `ADVISOR_FIRM_PRICE_IDS.enterprise` |

**Checkout:** `POST /api/stripe/firm-checkout` — quantity = seat count.

**Consumer handoff:** No extra Stripe product — app sets `advisor_managed` when toggle ON.

**Go-live note:** LAUNCH_CHECKLIST allows **manual invoice** for first advisor firms until firm checkout is verified end-to-end.

### Attorney — per **attorney account** (solo today; firm seats = L5)

| Tier | Client households | Launch target $/mo | Competitive band | Stripe env |
|------|-------------------|-------------------|------------------|------------|
| Free (0) | 3 | $0 | — | — |
| Starter (1) | 15 | **$99** | Below Clio Essentials ~$89; adjunct not PMS | `STRIPE_PRICE_ATTORNEY_STARTER_MONTHLY` |
| Growth (2) | 50 | **$249** | Solo power user / small firm | `STRIPE_PRICE_ATTORNEY_GROWTH_MONTHLY` |

**Consumer handoff:** Optional via toggle — no separate Stripe SKU; attorney firm subscription covers sponsored tier when enabled.

### Decision checklist (fill before `PUBLIC_SIGNUP_OPEN`)

- [ ] Confirm consumer tier prices (monthly + annual) in Stripe live mode
- [ ] Confirm advisor firm seat prices — [competitive benchmarks §](./BILLING_B2B2C_POLICY.md#competitive-pricing-benchmarks-2026); update `lib/tiers.ts` live `price_…` IDs
- [ ] Confirm attorney solo tier prices — set `STRIPE_PRICE_ATTORNEY_*` in Vercel
- [ ] **Advisor consumer handoff:** leave default ON unless testing “consumer pays” segment
- [ ] **Attorney consumer handoff:** leave default OFF at launch; document when to flip ON (e.g. Clio-style firm portal pitch)
- [ ] If attorney handoff ON: set `B2B2C_ATTORNEY_MANAGED_TIER` (2 vs 3) and disclose in attorney ToS / engagement materials
- [ ] Run B2B2C test: paid consumer → connect → Stripe `cancel_at_period_end` → disconnect → tier restored

---

## Scenarios (quick reference)

### Advisor connect, handoff ON (default)

1. Consumer on paid Estate → advisor accepts
2. Profile: `subscription_status=advisor_managed`, `consumer_tier=3`
3. Stripe: active sub → `cancel_at_period_end=true`
4. `/billing`: “Managed by your advisor”

### Advisor connect, handoff OFF

1. Same connection flow
2. Consumer tier and Stripe **unchanged**
3. Collaboration features still work via advisor RLS link

### Attorney connect, handoff OFF (default at launch)

1. Consumer connects via `/my-attorney`, invite, or intake
2. Attorney pays own tier for client cap; consumer keeps own plan
3. Read-only estate + vault collaboration

### Attorney connect, handoff ON (future market)

1. Set `B2B2C_ATTORNEY_CONSUMER_BILLING=true`
2. Profile: `attorney_managed`, tier 2 (or 3 if configured)
3. Same Stripe pause/resume pattern as advisor
4. `/billing`: “Managed by your attorney”

---

## Firm multi-seat (L5) — separate from this doc

| | Advisor | Attorney |
|---|---------|----------|
| **Today** | `firms` + `/advisor/firm` + seat checkout | Solo account only |
| **L5 backlog** | — | Multi-attorney firm entity + shared seat billing |

Consumer handoff toggles work **independently** of firm seat billing — you can have firm seats without sponsoring consumers, or sponsor consumers on solo attorney accounts.

---

## Ops / compliance

- **Washington auto-renewal / FTC:** Consumer handoff must still allow self-serve cancel **after** disconnect restores billing — see [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md).
- **Terms:** Disclose when a professional connection changes who pays (advisor/attorney-managed language in ToS § billing).
- **Webhook:** Never overwrite `advisor_managed` / `attorney_managed` from Stripe subscription events.

---

## Decision log (2026-06-07)

**Decision:** Configurable B2B2C consumer billing handoff per professional role — advisor default ON (market norm), attorney default OFF (flex for go-to-market). Shared implementation in `managedConsumerBilling.ts`; pricing matrix TBD in Stripe before open signups.

**Alternatives rejected:** Hard-code attorney same as advisor (wrong for many law firms); separate Stripe product per managed consumer (unnecessary — app status suffices).
