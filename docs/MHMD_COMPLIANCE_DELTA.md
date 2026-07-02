# MWM — WA My Health My Data Act (MHMD) Compliance Delta

**Owner:** Al Voels · **Statute:** RCW 19.373 (HB 1155)
**Last updated:** 2026-06-29
**Status:** CONDITIONAL — do not execute until the threshold question is answered.

**Related:** [POST_LAUNCH_REMAINING §2](./POST_LAUNCH_REMAINING.md) (counsel question) · [LAUNCH_START_HERE.md](./LAUNCH_START_HERE.md) (gate map)

> **This is a working execution doc, not legal cover.** The counsel read sits on top of it. I'm not a lawyer; the items below are a factual mapping of the Act's requirements against current MWM state, to be run *only if* counsel determines a field qualifies.

---

## The gate that decides whether ANY of this applies

**Threshold question:** do any MWM fields — advance directive, healthcare proxy, incapacity / long-term-care planning, or anything identifying a consumer as seeking health-care services — meet the Act's broad definition of "consumer health data" (CHD)?

- The definition reaches data about physical/mental health status, "bodily functions," data identifying someone seeking health-care services, and inferences drawn from non-health data. It is deliberately broad.
- Counterargument: an advance directive / healthcare proxy is a *legal instrument* about decision-making authority, not a record of health *status*. That's a real argument — and exactly why this is a counsel call, not a self-assessment.
- **If counsel says NO → this entire doc is moot. Archive it.**
- **If counsel says YES (even for one field) → execute the NEW BUILD and LEGAL-JUDGMENT items below.**

There are **no revenue or user-count thresholds** under MHMD — unlike the comprehensive privacy laws, being small/pre-launch does not exempt you. The only gate is the classification question above.

---

## Legend

| Tag | Meaning |
|-----|---------|
| ✅ **DONE** | Already satisfied by existing MWM infrastructure; confirm and document |
| 🔨 **BUILD** | New, concrete work required |
| ⚖️ **JUDGMENT** | Requires a legal decision before/while building |

---

## Summary

| # | Requirement | Tag |
|---|-------------|-----|
| 1 | Standalone Consumer Health Data Privacy Policy + separate homepage link | 🔨 BUILD |
| 2 | Consent vs. necessity decision (bundled ToS checkbox does NOT count) | ⚖️ JUDGMENT → 🔨 BUILD |
| 3 | Map CHD data flows (which fields, to which processors/affiliates) | 🔨 BUILD (doc) |
| 4 | Processor contracts (DPAs) meeting MHMD binding-contract standard | 🔨 BUILD (confirm) |
| 5 | Rights program: appeal mechanism + 45-day SOP | 🔨 BUILD |
| 6 | Deletion: propagate to processors/affiliates + backups | 🔨 BUILD (extend existing) |
| 7 | Withdrawal-of-consent handling (→ likely account closure path) | ⚖️ JUDGMENT → 🔨 BUILD |
| 8 | Access right incl. list of third parties/affiliates | ✅ DONE (extend export) |
| 9 | Security: reasonable standard of care + access restriction | ✅ DONE (confirm) |
| 10 | Selling prohibition (affirm never sell CHD) | ✅ DONE |
| 11 | Geofencing prohibition | ✅ DONE (N/A) |

---

## NEW BUILD

### 1. Standalone Consumer Health Data Privacy Policy 🔨
**Requirement:** A *separate and distinct*, plainly-labeled "Consumer Health Data Privacy Policy," prominently linked on the homepage as its own link. Cannot be merged into the general privacy policy or contain unrelated content.
**Today:** General privacy policy live at `/privacy`. No standalone CHD policy; no separate homepage link.
**Action:**
- [ ] Draft CHD policy: categories of CHD collected, why, sources, what's shared, specific affiliates + categories of third parties, and how to exercise rights.
- [ ] Add a distinct homepage link (separate from the `/privacy` link), plainly labeled.
- [ ] Keep it in sync with the data-flow map (#3) — new categories/purposes require updated disclosure + fresh consent.

### 3. Map CHD data flows 🔨 (documentation)
**Requirement:** Accurate disclosures + ability to answer an access request listing all third parties/affiliates that received the data.
**Today:** No CHD-specific data map.
**Action:**
- [ ] Identify exactly which fields counsel classified as CHD.
- [ ] For each, trace storage + every processor it touches (Supabase, Vercel, Resend, Cloudflare, Stripe, Sentry) and any affiliate/advisor/attorney recipient.
- [ ] Produce the maintained "third parties & affiliates" list that backs the access right (#8).

### 4. Processor contracts (DPAs) 🔨 (confirm/upgrade)
**Requirement:** Each processor must operate under a binding contract setting processing instructions and limiting them to those instructions; processor must assist your compliance.
**Today:** Standard vendor relationships; DPA status per vendor not confirmed against the MHMD bar.
**Action:**
- [ ] Confirm a DPA is in place for each: Supabase, Vercel, Resend, Cloudflare, Stripe, Sentry.
- [ ] Confirm each covers health data and meets the binding-contract / assist standard.
- [ ] File copies; note effective dates.

### 5. Rights program — appeal + 45-day SOP 🔨
**Requirement:** Respond to rights requests within 45 days (one 45-day extension), free up to twice/year, with a conspicuous internal appeal process; denials must route the consumer to the AG.
**Today:** Request aliases exist (`privacy@`, `legal@`, `security@`). 45-day manual portability SOP was a drafted position. No confirmed appeal mechanism.
**Action:**
- [ ] Stand up the appeal flow (intake → written outcome → AG-contact path on denial).
- [ ] Formalize the 45-day tracking SOP (clock start, extension trigger, ≤2 free/year, reasonable authentication).

### 6. Deletion — propagate to processors/affiliates + backups 🔨 (extend existing)
**Requirement:** On a verified request, delete CHD across all systems including backups (up to 6 months for backups), and notify affiliates, processors, contractors, and other third parties to do the same.
**Today:** WCPA deletion pipeline + audit trail already built — strong foundation.
**Action:**
- [ ] Extend the pipeline to notify processors/affiliates/third parties on deletion.
- [ ] Confirm backup deletion is handled within the 6-month window.
- [ ] Verify the audit trail records the propagation.

---

## LEGAL-JUDGMENT (decide, then build)

### 2. Consent vs. necessity ⚖️ → 🔨
**The problem:** Acceptance of a bundled general ToS does NOT count as MHMD consent. Your `terms_accepted_at` signup checkbox is exactly that, so it cannot carry CHD consent.
**The two legal bases (you need one):**
- **Necessity** — no separate consent is required to collect/use CHD that is *necessary to provide the service the consumer requested*. Collecting an advance-directive field to deliver the estate analysis the user asked for plausibly qualifies. **Document this position per field.**
- **Opt-in consent** — for anything beyond necessity, a discrete, affirmative, specific, unbundled opt-in at the point of collection.
**Action:**
- [ ] Counsel decides, per CHD field: necessity vs. requires-consent.
- [ ] For necessity fields: document the basis in the data map.
- [ ] For consent fields: 🔨 build a discrete opt-in prompt at point of entry (not at signup, not bundled).
- [ ] Note: "sharing" with advisors/attorneys the consumer themselves connected likely falls under the necessity exception *and/or* the "direct relationship with the consumer" carve-out — confirm, don't assume.

### 7. Withdrawal of consent ⚖️ → 🔨
**The problem:** Consumers can revoke consent anytime. With no alternative legal basis, withdrawal can end your ability to keep processing — for a product built on the data, that effectively means the account can't continue.
**Action:**
- [ ] Counsel: confirm withdrawal → mandatory cessation/deletion for CHD-dependent accounts.
- [ ] 🔨 Design the withdrawal path deliberately (likely: withdrawal triggers an account-closure/deletion flow with clear user messaging), rather than discovering the conflict live.

---

## ALREADY DONE (confirm & document)

### 8. Access right + third-party list ✅ (extend export)
Raw-data export already exists. Add the maintained third-parties/affiliates list (from #3) so an access response is complete. Mostly documentation.

### 9. Security — reasonable standard of care ✅ (confirm)
RLS (27/27 attested), MFA, encryption, and solo-operator access already meet the "reasonable standard of care" + access-restriction bar. Confirm and note in the CHD policy.

### 10. Selling prohibition ✅
MWM does not sell data. No written-authorization machinery needed. Affirm "we never sell consumer health data" in the CHD policy.

### 11. Geofencing prohibition ✅ (N/A)
Absolute ban on geofences within 2,000 ft of healthcare facilities to track/collect/target. MWM does not geofence. One-line "N/A" — but never add location-based targeting near facilities without revisiting this (no consent cures it; it's absolute).

---

## Execution note

If the classification comes back YES, the real scope is: **one new policy page + homepage link (#1), the consent decision and possibly one consent prompt (#2), DPA confirmations (#4), an appeal mechanism + SOP (#5), deletion-propagation extension (#6), and a withdrawal path (#7).** Everything else is confirm-and-document. That's a bounded sprint, not a rebuild — because the deletion and security spine already exists.

The load-bearing dependency is the classification (gate at top). Buy that counsel hour first; everything here is downstream of it.
