# Counsel Privacy Review — Cover Memo

**To:** Privacy / regulatory counsel  
**From:** My Wealth Maps engineering  
**Date:** June 20, 2026  
**Re:** Multi-state Privacy Policy implementation — redline request  
**Status:** Engineering draft implemented; **not launch-ready** until counsel redline

---

## Purpose

We completed an internal compliance assessment of our Privacy Policy, Terms of Service, and operational SOPs against Washington statutes and the 20 U.S. state comprehensive privacy laws in effect as of 2026. This memo packages the baseline draft, what we changed in code, and the open questions that require legal judgment before publication.

**Attached baseline:** [MWM_MultiState_Privacy_Terms_Draft.md](./MWM_MultiState_Privacy_Terms_Draft.md)

**Conditional engineering (post-counsel):** [PRIVACY_COUNSEL_ENGINEERING_MATRIX.md](./PRIVACY_COUNSEL_ENGINEERING_MATRIX.md) — maps each open question to text-only vs. small/medium/large engineering work.

---

## Strategy adopted

**Unified policy, highest common denominator:** one Privacy Policy granting CCPA/Virginia-model rights to **all U.S. residents**, with thin state-specific addenda only where statutes compel specific wording. We rejected state-by-state segmentation (operational risk) and lowest-common-denominator compliance (trust and threshold-crossing risk).

---

## What we implemented (engineering)

| Area | Change |
|------|--------|
| **Privacy Policy** | Rewrote `lib/legal/privacy-policy-sections.ts` — all-U.S. rights (§7), appeals (§8), purposes-of-processing (§4), Sentry subprocessor, GPC language (§11), children 18+ (§12), multi-state breach catch-all (§10). Version `2026-06-20`. |
| **State addenda** | New `lib/legal/privacy-policy-addenda.ts` — CA, Virginia-model, minors, Washington (RCW 19.316, RCW 19.255.010, MHMD placeholder). Appended on `/privacy`. |
| **WCPA mislabel fix** | Removed incorrect "Washington WCPA" attribution for privacy rights in admin UI, consumer privacy form, compliance calendar, OpenAPI summary, and page metadata. WCPA = RCW 19.86 (unfair practices), not privacy law. |
| **GPC** | `lib/privacy/globalPrivacyControl.ts` + middleware cookie when `Sec-GPC: 1` is present. |
| **Assess email capture** | Privacy notice + link on `/event/[slug]/assess` before checklist email submit. |
| **Appeals ops** | Migration adds `appealed` status to `privacy_requests`; admin UI option; denial email with appeal instructions (`lib/email/privacyRequestDecisionEmail.ts`). |
| **SOP** | Updated `docs/COMPLIANCE_CALENDAR.md` privacy request SOP for appeals (60-day response). |

---

## Current vs. proposed — key diffs

### Rights scope (§7)

| Before | After |
|--------|-------|
| "Washington residents" / "Washington WCPA" | "All United States residents" |
| No appeals section | §8 Appeals — 60-day written response + AG path |
| MHMD cited as legal basis for all processing (§4) | §4 Purposes of Processing — plain language; MHMD only in WA addendum if applicable |

### Subprocessors (§5)

| Before | After |
|--------|-------|
| Supabase, Vercel, Stripe, Resend | **+ Sentry** (error monitoring, `sendDefaultPii: false`) |

### Cookies (§11)

| Before | After |
|--------|-------|
| Session/security cookies only | **+ Global Privacy Control honored** (middleware implements cookie) |

### Children (§12)

| Before | After |
|--------|-------|
| Under 13 (COPPA framing) | **18+** aligned with ToS eligibility |

---

## Open questions for counsel (ranked)

These mirror Part 4 of the attached draft. **Do not treat the new policy as final until these are resolved.**

1. **MHMD / consumer health data (highest exposure).** Do any fields (advance directive, healthcare POA, incapacity/LTC inputs, health-adjacent free text) qualify as "consumer health data" under Washington MHMD? If yes: separate Consumer Health Data Privacy Policy, opt-in consent, distinct share authorization, private right of action.
2. **GLBA / sector exemption.** Confirm My Wealth Maps is not entity- or data-exempt under GLBA or similar — affects scope of state law applicability.
3. **Threshold applicability today.** Which state laws legally bind us at current scale? Recommendation: comply voluntarily regardless; confirm for DPIA obligations (CO/CT/CA).
4. **"Sale"/"Share" definitions.** Confirm "we do not sell or share" holds under broad statutory definitions given Sentry and other subprocessors.
5. **GPC implementation adequacy.** We set an opt-out cookie on `Sec-GPC: 1`. Confirm this satisfies CA/CO/CT/TX requirements or specify additional product work.
6. **Assess email-capture consent.** Notice + Privacy Policy link added; no checkbox. Confirm notice-only is sufficient or require explicit consent checkbox.
7. **Self-service portability.** Portability promised; fulfillment is manual admin JSON export within 45 days. Confirm SOP meets statutory "readily accessible" standard or require self-service export.
8. **California addenda completeness.** CCPA category table not yet published; Shine the Light added in addendum. Confirm ADMT/automated-decision regulations do not apply.
9. **Multi-state breach catch-all.** §10 includes WA RCW 19.255.010 + catch-all for other states. Confirm sufficient vs. per-state enumeration.
10. **ToS §3 residency attestation.** PR #59 geo-gate + US billing validation in progress. Counsel decision: add explicit signup checkbox + `us_residency_attested_at`?

---

## Pre-publication checklist

- [ ] Counsel redline applied to `lib/legal/privacy-policy-sections.ts` and addenda
- [ ] Counsel answers Q1–Q10 documented; engineering scoped via [PRIVACY_COUNSEL_ENGINEERING_MATRIX.md](./PRIVACY_COUNSEL_ENGINEERING_MATRIX.md)
- [ ] MHMD determination documented (Q1)
- [ ] DPAs confirmed with all subprocessors including Sentry (Q4)
- [ ] GPC implementation validated against counsel guidance (Q5)
- [ ] `PRIVACY_POLICY_VERSION` bump triggers terms backfill / re-acceptance flow if required
- [ ] Migration `20260720120000_privacy_requests_appealed_status.sql` applied to production
- [ ] Do **not** publish MHMD-specific flows or full CA category table until Q1/Q8 resolved

---

## Files for redline

| File | Role |
|------|------|
| `lib/legal/privacy-policy-sections.ts` | Main policy body |
| `lib/legal/privacy-policy-addenda.ts` | State addenda |
| `lib/legal/terms-of-service-sections.ts` | ToS (minimal changes per draft Part 3) |
| `docs/COMPLIANCE_CALENDAR.md` | Operational SOP |
| `docs/legal/MWM_MultiState_Privacy_Terms_Draft.md` | Full baseline draft |

---

## Contact

Engineering: avoels@comcast.net  
Privacy inbox (operational): privacy@mywealthmaps.com
