# MWM — First-Wave Outreach & Early-Access Plan

**Owner:** Al Voels · **Market:** Washington State launch
**Last updated:** 2026-06-29
**Status:** Ready to stage. Advisor/attorney outreach can send NOW; consumer pilots carry a residual compliance gate (below). Paid conversion triggers on the B&O ruling.

---

## The core reframe

The B&O / DAS ruling gates **charging WA customers** — Stripe Tax at checkout, the §13 ToS tax branch. It does **not** gate a **free** pilot, because a no-charge pilot has no taxable sale.

So the ruling is the trigger for **converting pilots to paid**, not the trigger for **first contact.** This decouples your go-to-market from the ruling: relationship-building and free onboarding start now; billing flips when B&O clears.

```
NOW (ruling pending)                 B&O RULING CLEARS
────────────────────                 ─────────────────
Send advisor + attorney outreach     PUBLIC_SIGNUP_OPEN=true
Onboard free pilots (no charge)      Stripe Tax configured
Capture founding-member commitments  Pilots convert at locked founding rate
Gather usage + WTP signal            Open self-serve paid signup
```

> **Tax caveat (not legal/tax advice):** "Free avoids B&O" is sound — no sale, no sales/DAS tax to collect; no gross receipts on those users. But confirm with your accountant that (a) a free pilot doesn't itself create a filing obligation and (b) running it doesn't complicate the pending ruling. One email to settle it.

---

## What "free" clears — and what it doesn't

| Gate | Free advisor pilot | Free attorney pilot | Free consumer pilot |
|------|:---:|:---:|:---:|
| B&O / DAS sales-tax (paid checkout) | ✅ cleared (no charge) | ✅ cleared (no charge) | ✅ cleared (no charge) |
| §13 ToS tax-treatment branch | ✅ moot until paid | ✅ moot until paid | ✅ moot until paid |
| ToS acceptance (`terms_accepted_at`) | ✅ already at signup | ✅ already at signup | ✅ already at signup |
| Household-alert copy counsel review (GRAT/Roth) | ✅ N/A (no consumer advice surface) | ✅ N/A | ⚠️ **STILL APPLIES** |
| WA MHMD "consumer health data" determination | ✅ N/A | ✅ N/A | ⚠️ **STILL APPLIES** |

**Takeaway:** advisor and attorney free pilots are unblocked today. Consumer free pilots are unblocked *on tax* but still need the two consumer-compliance items — which is why the recommended consumer path routes through pilot advisors (next section).

---

## Provisioning mechanics — how "free" actually works per bucket

The principle: **no Stripe charge = no taxable transaction.** Each bucket reaches free differently.

- **Attorney — use the existing $0 tier.** Attorney pricing is already `$0 / $99 / $249` by household cap. The $0 tier *is* free, self-serve, no transaction. Nothing to build — just point them at it.
- **Advisor — comp during the free pilot; coupon at conversion.** Advisor per-seat products *do* exist in Stripe (Starter/Growth/Enterprise per-seat checkout via `/api/stripe/firm-checkout`, built 2026-06-12). During the free pilot you simply don't run checkout — hand-provision (`role='advisor'`) and don't charge. At conversion they go through Stripe checkout like everyone else and take the founding coupon (see Founding-Rate Mechanics below). The only advisor piece still manual is the connection-state automation (auto-pausing a consumer's own sub when they become `advisor_managed`).
- **Consumer — invite/comp grant, no checkout.** Use the server-gated invite/beta path (auto-confirms email) to grant Tier 3 **without** routing through Stripe. Do **not** collect a card "to charge later" — that blurs the no-sale line. Truly comp it.

> Keep all three off Stripe during the pilot. The moment a card is charged, the B&O/DAS question is live.

---

## The founding-member structure (so you still learn pricing)

Free-to-start, but framed as a **Founding Member** program with an explicit conversion:

- **Window:** free through launch, or 60–90 days, whichever is cleaner to message.
- **The ask up front:** a soft commitment — "if it delivers value, you'll move to the founding rate when billing opens." Not a contract; a stated expectation that filters tire-kickers from real prospects.
- **The carrot:** a locked founding rate below standard, honored for 12 months. (Suggested: 30–40% off the relevant tier — your call.)
- **The trigger:** when B&O clears, founding members get a "your founding rate is live" email, not a cold sell. The relationship and the usage are already there.

This converts the pilot from "I gave product away and learned nothing" into a real willingness-to-pay test with a built-in close.

---

## Founding-Rate Mechanics — coupons + caps

**Decided:** 30% off, locked 12 months. Per-persona caps: **attorneys 25, advisors 25, consumers 10.**

**Don't build a new price or a "changeable" SKU.** Stripe Prices are immutable — you can't edit `unit_amount` later. The right tool is a **Coupon** (`percent_off: 30`, `duration: repeating`, `duration_in_months: 12`) applied to your *existing* canonical prices. After 12 months the coupon falls off automatically and they roll to standard — the 12-month lock is native, no migration code. This works for **all three buckets via Stripe checkout** (consumer, paid attorney tiers, and advisor per-seat — a percent-off coupon applies to the whole subscription regardless of seat quantity). The $0 attorney tier and any pre-B&O comped pilots need no coupon at all — they're already free.

**Why three coupons, not one.** To enforce *both* the discount AND the per-persona cap, create one coupon per persona, each restricted to that persona's products via `applies_to.products`, each fronted by one **Promotion Code** carrying the cap in `max_redemptions`. The product restriction means a consumer can't apply the advisor code; the `max_redemptions` enforces the count. (Simpler alternative: one coupon + three promo codes with different caps — but then the caps rely on each persona only being handed their own code, with no product-level enforcement. Given the caps differ, the three-coupon version is the defensible one.)

**Run the verify script first.** [`scripts/verify-founding-codes.mjs`](../scripts/verify-founding-codes.mjs) is read-only — it confirms which account/mode you're on, lists the active products + prices (so you can copy the per-persona **PRODUCT IDs** for `applies_to`), and checks that none of the three founding codes already exist. Run it, confirm a clean result, then create.

```
EXPECTED_STRIPE_ACCOUNT_ID=acct_1TAIt0ENTkKmTNa3 \
STRIPE_SECRET_KEY=sk_live_xxx \
node scripts/verify-founding-codes.mjs
```

**Create step (after verify is clean).** Per persona, create the coupon then its promo code. Dashboard works, or scripted:

```js
// for each persona: { name, productIds:[...from verify...], cap }
const coupon = await stripe.coupons.create({
  name: 'Founding 30% (Attorney)',
  percent_off: 30,
  duration: 'repeating',
  duration_in_months: 12,
  applies_to: { products: productIds },   // persona's product IDs from verify output
});
await stripe.promotionCodes.create({
  coupon: coupon.id,
  code: 'FOUNDINGATTORNEY',               // FOUNDINGADVISOR / FOUNDINGCONSUMER
  max_redemptions: cap,                    // 25 / 25 / 10
  active: false,                           // flip to true on launch day
});
```

| Persona | Promo code | Cap | Discount | Lock |
|---------|-----------|-----|----------|------|
| Attorney | `FOUNDINGATTORNEY` | 25 | 30% | 12 mo |
| Advisor | `FOUNDINGADVISOR` | 25 | 30% | 12 mo |
| Consumer | `FOUNDINGCONSUMER` | 10 | 30% | 12 mo |

**Timeline (sequential, not overlapping):** free through launch (comp grant, no Stripe charge — coupon clock not started) → at launch each founding member converts to paid and the **12 discounted months start from their own conversion date** → standard price after. So the real offer is *free through launch, then 12 discounted months* — more generous than "12 months total," which is the right first-cohort shape.

**Checkout wiring:** all three subscription checkout routes set `allow_promotion_codes: true` on the Checkout Session — consumer via `processConsumerCheckout`, plus `/api/stripe/attorney-checkout` and `/api/stripe/firm-checkout`. Founding members enter **FOUNDINGATTORNEY** / **FOUNDINGADVISOR** / **FOUNDINGCONSUMER** at checkout on ruling day.

> Create the promo codes with `active: false` and flip them to `active: true` on launch day, so a leaked code can't be redeemed before B&O clears.

---

## BUCKET 1 — ATTORNEYS *(send now)*

**Why first:** they validate the referral model and they're your cleanest free path (the $0 tier already exists).

**The tightened 5.** Draw from your 9 HIGH list. Confirmed anchors from the directory research: **Angela Macey-Cushman** (WSBA #38320), **James Flaggert** (WSBA #20965), **Sarah B. Bowman** (Perkins Coie, Seattle — the corrected current EP partner). Slot two more from the HIGH tier; prioritize solo/small-firm EP specialists over big-firm partners for pilot responsiveness.

**The offer:** "Claim your free directory listing + run up to 3 client households through the platform at no cost. It calculates each household's WA estate-tax exposure and generates a one-page meeting brief."

**Email — Attorney first wave:**

> **Subject:** Your listing on My Wealth Maps — [Attorney Name]
>
> Hi [First Name],
>
> I'm Al Voels, founder of My Wealth Maps — a new estate-planning intelligence platform for Washington households in the $2M–$15M range.
>
> I've created a listing for you in the platform's attorney directory (live now, built from public sources — claiming it takes about five minutes to add your focus areas and bio).
>
> I'd also like to offer you free founding access: run up to three client households through the platform at no cost. It calculates each household's Washington estate-tax exposure in real time — the $3M state exemption catches more households than people expect once homes and retirement accounts are counted — and generates a one-page brief you can take into a meeting.
>
> I've attached a short guide on Washington's estate tax, including the ESB 6347 changes that took effect this year — yours to share with clients, no strings.
>
> Happy to do a 20-minute walkthrough if useful.
>
> Al Voels · Founder, My Wealth Maps · mywealthmaps.com · al@mywealthmaps.com

**Leave-behind:** WA_Estate_Tax_Explainer.pdf on every send.

---

## BUCKET 2 — ADVISORS *(send now)*

**Why:** advisors drive consumer pilot signups (your consumer path routes through them) and they're the B2B2C flywheel.

**The tightened 5** = your 4 HIGH + 1 promoted MEDIUM. Named standouts from the research:
- **Joe Cervantes — Coldstream** (CFP®, CLU®, AEP® — the AEP signals EP is his primary specialty; warmest lead).
- **Terry Cook — Parcion** (Forbes #1 in WA; firm built for business owners in liquidity events — exactly your WA estate-tax-exposed profile).
- **Julie Parisio Roy — Badgley Phelps** (stepped into CEO in 2024; new leadership = openness to new tools).
- + the 4th HIGH advisor, and one MEDIUM promoted after FINRA verification.

**Verify before sending (from the research notes):** Occidental's Bellevue office is a satellite (Managing Principal based in Burlingame, CA — find the local advisor via FINRA BrokerCheck); LNW rebranded from Laird Norton (use lnwadvisors.com/team); Pure Financial acquired Kaufman Kampe (confirm Kaufman/Kampe still at Mercer Island). All CRD numbers verifiable at brokercheck.finra.org.

**The offer:** "Free founding access — run your client households through the platform at no cost. Send a strategy recommendation (SLAT, ILIT, bypass trust) to a client, they accept it, and watch the estate-tax number move. That's the thing eMoney and RightCapital can't show your clients."

> **Weave in the moat:** lead the advisor email with the *strategy-recommendation flywheel*, not the feature list. The differentiator versus their existing portal is the accept-and-recompute loop, not the calculator.

**Email — Advisor first wave:**

> **Subject:** A Washington estate-tax tool for your HNW clients — free founding access
>
> Hi [First Name],
>
> I'm Al Voels, founder of My Wealth Maps. I built it for the gap your existing planning tools don't quite fill: showing a client, in real numbers, what their Washington estate-tax exposure is and what a specific strategy would do about it.
>
> Here's the part I think you'll find useful: you can send a client a strategy recommendation — a SLAT, an ILIT, a bypass trust — and when they accept it, the platform recomputes their estate-tax exposure live. The client sees the number move. It turns an abstract recommendation into something they can see the value of.
>
> I'd like to offer you free founding access to run your own client households through it — no cost, no commitment. [Standout-specific line — e.g. for Cervantes: "Given your AEP focus, I think the WA-specific modeling will line up closely with how you already work."]
>
> Twenty minutes to show you the flywheel in action?
>
> Al Voels · Founder, My Wealth Maps · mywealthmaps.com · al@mywealthmaps.com

---

## BUCKET 3 — CONSUMERS *(stage now, gate-check before onboarding)*

**The recommended path: route consumer pilots through your pilot advisors.** Don't run a separate cold consumer campaign for the first wave. Reasons:
1. It solves the cold-start data-entry problem — the advisor (or their staff) helps enter the household, which is the #1 friction killer for planning tools.
2. The advisor owns the relationship, so the only residual gate is the copy review (below), not a broad consumer-acquisition compliance surface.
3. It proves the B2B2C loop directly: advisor invites client → client onboards → advisor sends strategy → number moves. That's your whole thesis in one motion.

**Plus a tiny direct set:** 5–10 hand-picked households from your own network (the kind of $2–30M, business-owner / liquidity-event profile you're built for). Comp them the same way.

**The two gates that still apply to consumer pilots (free or not):**
- ⚠️ **Household-alert copy counsel review** — the GRAT/Roth advice-vs-fact clearance. If it wasn't in the 2026-06-19 review, it must clear before a consumer sees those alerts. *(Tracked as item 3 in [POST_LAUNCH_REMAINING.md](./POST_LAUNCH_REMAINING.md).)*
- ⚠️ **WA MHMD determination** — whether advance-directive / healthcare-proxy / incapacity fields are "consumer health data." *(Item 2 in [POST_LAUNCH_REMAINING.md](./POST_LAUNCH_REMAINING.md); execution checklist in [MHMD_COMPLIANCE_DELTA.md](./MHMD_COMPLIANCE_DELTA.md).)*

**Provisioning:** invite/beta flag → Tier 3 grant → no Stripe. Founding-member framing applies.

**Email — Consumer founding member (advisor-introduced):**

> **Subject:** [Advisor name] set you up with early access to My Wealth Maps
>
> Hi [First Name],
>
> [Advisor first name] thought you'd find this useful, so I've set up free founding-member access for you.
>
> My Wealth Maps shows you, in plain numbers, where your estate plan stands today — your Washington estate-tax exposure, any gaps like missing beneficiaries or unfunded trusts, and what specific strategies would change. You and [Advisor] can work from the same picture.
>
> Your access is free through launch as a founding member. When we open paid plans, you'll have the option to continue at a locked founding rate — no obligation, and nothing to enter now but your assets.
>
> [Get started link]
>
> Al Voels · Founder, My Wealth Maps

---

## Sequencing & triggers

| When | Action |
|------|--------|
| **Now — week 1** | Confirm tax caveat with accountant. Finalize the 5 attorneys + 5 advisors (FINRA/WSBA verification). Send Bucket 1 (attorneys) + Bucket 2 (advisors). |
| **Now — week 1** | Clear the two consumer compliance gates (copy review + MHMD) so consumer pilots are unblocked. |
| **Weeks 1–2** | As advisors say yes, onboard them free; have them invite 1–3 client households each. Onboard your 5–10 direct consumer pilots. |
| **Ongoing** | 4-touch follow-up cadence (Day 0 / 6 / 14 / 22) on non-responders. Reference early momentum in later waves ("a few Seattle EP attorneys have already come on..."). |
| **B&O RULING CLEARS** | Configure Stripe Tax. `PUBLIC_SIGNUP_OPEN=true`. Send founding members their "rate is live" conversion email. Open self-serve paid signup. |

---

## Pre-flight checklist — have these staged so launch is one motion

- [ ] Tax caveat confirmed with accountant (free pilot ≠ filing wrinkle).
- [ ] Final 5 attorneys chosen + WSBA verified; directory listings live.
- [ ] Final 5 advisors chosen + CRD verified via FINRA BrokerCheck.
- [ ] All emails personalized (standout-specific lines filled for Cervantes/Cook/Parisio Roy etc.).
- [ ] WA_Estate_Tax_Explainer.pdf attached and current.
- [ ] Invite/beta comp path tested — grants Tier 3 with **no** Stripe charge.
- [x] Founding rate decided — **30% off, 12-month lock** (see Founding-Rate Mechanics above).
- [x] `scripts/verify-founding-codes.mjs` in repo (run before creating codes in Stripe).
- [ ] Founding promo codes created in Stripe (`active: false` until B&O clears).
- [ ] Consumer copy review (GRAT/Roth) cleared.
- [ ] WA MHMD determination answered.
- [x] Conversion emails drafted — see [B&O-Day Conversion Emails](#bo-day-conversion-emails-staged--fire-on-ruling-day) below.
- [ ] Send-from-personal-email, reply-to al@mywealthmaps.com confirmed.

---

## B&O-Day Conversion Emails (staged — fire on ruling day)

Trigger: B&O clears → promo codes flipped `active: true` → these send to founding members.
Warm reactivation, not a cold sell — the relationship and usage already exist.
Conversion window: 30 days from send. Fill `[deadline]` when you know ruling day.

### Attorney — founding rate live

> **Subject:** Your founding rate is live, [First Name]
>
> Hi [First Name],
>
> Quick update: My Wealth Maps is now open for paid plans, and your founding rate is ready.
>
> If the free tier has been enough, nothing changes — you keep it. If you've wanted the paid features (weekly client digest, document repository, the higher household cap), you can move up at the founding rate: **30% off, locked for 12 months.** Use code **FOUNDINGATTORNEY** at checkout.
>
> The founding rate is open through [deadline]; after that it's standard pricing.
>
> [Manage your plan →]
>
> Al Voels · Founder, My Wealth Maps

### Advisor — founding rate live

> **Subject:** Your founding seat rate is live, [First Name]
>
> Hi [First Name],
>
> My Wealth Maps is now open for paid plans. As a founding advisor, your seat pricing is locked at **30% off for 12 months** — code **FOUNDINGADVISOR** at checkout, applied across all your seats.
>
> You've already seen the part that matters: send a client a strategy recommendation, they accept, and the estate-tax number moves. This just keeps that running for your whole book at the founding rate.
>
> Open through [deadline], then standard per-seat pricing.
>
> [Set up your seats →]
>
> Al Voels · Founder, My Wealth Maps

### Consumer — founding rate live

> **Subject:** Your founding-member rate is ready, [First Name]
>
> Hi [First Name],
>
> My Wealth Maps is now open for paid plans, and as one of our founding members you have a rate locked in: **30% off, held for 12 months.** Use code **FOUNDINGCONSUMER** at checkout.
>
> Everything you've already built — your assets, your estate picture, the plan you and [Advisor name] have been working from — carries straight over. Nothing to redo.
>
> Your founding rate is open through [deadline].
>
> [Continue at your founding rate →]
>
> Al Voels · Founder, My Wealth Maps

---

## Open decisions for you

1. ~~**Founding rate**~~ — **decided:** 30% off, 12-month lock, caps 25/25/10 (see Founding-Rate Mechanics).
2. **Pilot window** — "through launch" vs. a fixed 60/90 days? Fixed dates create urgency; "through launch" is simpler while the ruling date is unknown.
3. **Consumer first wave** — advisor-routed only, or advisor-routed + your direct 5–10? Recommend both.
