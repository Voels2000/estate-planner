# MWM — Launch & GTM Working Set (START HERE)

**Owner:** Al Voels · **Last updated:** 2026-06-29

One entry point for launch planning while B&O is pending. Read this first; it tells you what blocks what and where to start.

---

## Doc map

| Doc | Covers | Use it when |
|-----|--------|-------------|
| [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md) | **Pre-flip engineering step-off** (items 1–9, PITR, Upstash) | Closing remaining flip gates |
| [POST_LAUNCH_REMAINING.md](./POST_LAUNCH_REMAINING.md) | Post-flip deferred work, priority-tagged (P0–P3) | Deciding what to fix after flip and in what order |
| [GTM_FIRST_WAVE.md](./GTM_FIRST_WAVE.md) | First-wave outreach (5 attorneys / 5 advisors) + free founding-member pilot plan | Running go-to-market while waiting on the ruling |
| [MHMD_COMPLIANCE_DELTA.md](./MHMD_COMPLIANCE_DELTA.md) | What WA My Health My Data Act would require *if* a field qualifies | Only after the classification question is answered |
| [LAUNCH.md](./LAUNCH.md) | Canonical go-live scoreboard (Bucket A–C) | Single source of truth for flip status |

*(A product enhancement roadmap was scoped but not yet written — see "Not yet a doc" below.)*

---

## What blocks what (the gate map)

```
B&O / DAS RULING ──────────────► Flip paid signup (PUBLIC_SIGNUP_OPEN=true)
  (Bucket A)                      Convert pilots to paid
                                  + PITR live, Upstash (recommended)

MHMD CLASSIFICATION ───────────► Execute MHMD_COMPLIANCE_DELTA build
  (one counsel hour)             AND gates free CONSUMER pilots

GRAT/ROTH COPY REVIEW ─────────► Consumer sees those alerts
  (counsel glance)               AND gates free CONSUMER pilots + consumer launch

(nothing blocks) ──────────────► Send advisor + attorney outreach
                                  Onboard free advisor + attorney pilots
```

**Read it this way:**

- **Advisor + attorney outreach and free pilots are unblocked TODAY.** Nothing in the gate map stops them — they need only contact verification (WSBA/FINRA) and a one-line tax-caveat confirm from your accountant. This is the high-leverage move while you wait.
- **Free consumer pilots have two gates:** the GRAT/Roth copy review and the MHMD classification. Route consumer pilots through your pilot advisors' clients so the advisor owns the relationship and these two are the only things to clear.
- **The B&O ruling gates money, not motion.** It blocks charging WA customers (paid signup flip + pilot conversion) — not first contact, not free onboarding.
- **MHMD classification is load-bearing twice:** it decides whether the entire MHMD delta executes, AND it's a consumer-pilot gate. Buying that counsel hour unblocks the most.

---

## Start-here sequence

1. **Confirm the tax caveat** (accountant): a free pilot doesn't create a filing wrinkle or complicate the pending ruling. *(GTM doc, pre-flight)*
2. **Initiate the MHMD counsel hour** (book now — runs on counsel's clock) **and send Bucket 1/2 outreach in parallel.** The counsel hour unblocks consumer pilots + the MHMD delta doc; attorney/advisor outreach does not depend on the MHMD answer.
3. **Clear the GRAT/Roth copy review** — confirm it was in the 2026-06-19 counsel pass; if not, clear it.
4. **Verify + finalize** the 5 attorneys (WSBA) and 5 advisors (FINRA BrokerCheck). *(GTM doc, Buckets 1–2)*
5. **Onboard** as advisors/attorneys say yes.
6. **Conversion emails** are staged in [GTM_FIRST_WAVE.md § B&O-Day](./GTM_FIRST_WAVE.md#bo-day-conversion-emails-staged--fire-on-ruling-day) — fire when B&O clears + promo codes go `active: true`.
7. **Work the launch-debt P1 items** (input-validation hardening) in parallel as bandwidth allows. *(POST_LAUNCH doc)*

Steps 1–6 are the unblocked path that moves the business. Step 7 is the engineering backstop that doesn't gate any of it.

**Engineering flip gates (parallel):** PITR propagation · Upstash on prod — see [PRE_FLIP_REMAINING.md](./PRE_FLIP_REMAINING.md).

---

## Pending decisions

From the GTM doc:

- ~~**Founding rate**~~ — **decided:** 30% off, 12-month lock, caps 25/25/10.
- **Pilot window** — "free through launch" vs. a fixed 60/90 days.

---

## Not yet a doc

The **product enhancement roadmap** — modeling depth (EBITDA business valuation, life-insurance/liability/income growth), conversion (estate preview before paywall, guided mode), the advisor strategy-recommendation flywheel, and the market-gap additions (security/trust surface, document vault) — was assessed against leading practice but not yet written up as its own priority-tagged doc. That's the fourth doc to add when you want it.
