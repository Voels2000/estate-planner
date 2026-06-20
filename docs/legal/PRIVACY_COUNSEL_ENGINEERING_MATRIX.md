# Privacy counsel responses → engineering matrix

**Purpose:** Map each open counsel question to concrete engineering work. Use this after counsel redlines the policy to decide what (if anything) to build before go-live.

**Related:** [COUNSEL_PRIVACY_REVIEW.md](./COUNSEL_PRIVACY_REVIEW.md) · [MWM_MultiState_Privacy_Terms_Draft.md](./MWM_MultiState_Privacy_Terms_Draft.md) · [COMPLIANCE_CALENDAR.md](../COMPLIANCE_CALENDAR.md)

**Status:** Engineering draft shipped in code (version `2026-06-20`); **policy not launch-ready** until counsel sign-off.

---

## Already wired (no counsel answer required to function)

| Capability | Files / routes | Notes |
|------------|----------------|-------|
| Unified Privacy Policy + addenda | `lib/legal/privacy-policy-sections.ts`, `lib/legal/privacy-policy-addenda.ts`, `/privacy` | Text only until counsel redlines |
| Privacy rights intake | `/settings/security`, `POST /api/consumer/privacy-request` | All five request types |
| Confirmation email | `lib/email/privacyRequestConfirmationEmail.ts` | Reference ID + 45-day deadline |
| Admin privacy queue | `DeletionCompliance.tsx`, `GET/PATCH /api/admin/deletions` | Status workflow incl. `appealed` (after migration) |
| Denial + appeal email | `lib/email/privacyRequestDecisionEmail.ts` | Fires when admin sets status `denied` |
| GPC signal detection | `lib/privacy/globalPrivacyControl.ts`, `middleware.ts` | Sets `mwm_gpc_opt_out` cookie on `Sec-GPC: 1` |
| GPC marketing suppression | `lib/privacy/readGpcOptOut.ts`, `POST /api/email-capture` | Skips drip enrollment when GPC signal or cookie present |
| Assess email notice | `app/(public)/event/[slug]/assess/page.tsx` | Privacy Policy link + marketing notice |
| Deletion path | `lib/compliance/deleteUser.ts`, admin execute, cron | Unchanged; supports deletion requests |
| Compliance SOP | `docs/COMPLIANCE_CALENDAR.md` | Appeals 60-day SLA documented |

**Pending ops (not counsel-dependent):** migrations `20260720120000` + `20260721120000` — ✅ staging 2026-06-18 · ⬜ apply to prod before B6 on main.

---

## Counsel question → engineering outcomes

### Q1 — MHMD / consumer health data (highest exposure)

| Counsel answer | Engineering required | Estimated scope |
|----------------|---------------------|-----------------|
| **No** — estate/financial data only; no consumer health data | **Text only:** finalize WA addendum MHMD paragraph (already drafted as negative); remove any MHMD placeholders | ~1 commit in `privacy-policy-addenda.ts` |
| **Partial** — free-text fields *could* contain health-adjacent info but we don't solicit it | **Medium:** field-level audit; optional UI warnings on health-adjacent inputs; counsel-approved disclaimer on those fields; update addendum | New copy in intake/forms; possible `lib/legal/` health disclaimer constant |
| **Yes** — we collect consumer health data | **Large:** separate Consumer Health Data Privacy Policy page; opt-in consent before collection; distinct authorization before share; consent withdrawal flow; MHMD-specific retention; possible separate consent records table | New route `/privacy/consumer-health-data`, migration for consent timestamps, middleware or form gates on health fields, admin export for consent audit |

**Key files if Yes:** new `lib/legal/consumer-health-data-policy-sections.ts`, consent UI on any health-adjacent fields, `profiles` or `household_consents` table, update `deleteUser.ts` FK list.

---

### Q2 — GLBA / sector exemption

| Counsel answer | Engineering required |
|----------------|---------------------|
| **No exemption** | None — current unified policy stands |
| **Partial exemption** (some data exempt) | **Medium:** policy addendum listing exempt categories; possible data-classification tags in schema or docs only |
| **Full GLBA exemption** | **Large:** scope reduction in policy; may remove some state-law obligations for exempt data — counsel-driven text + possible admin labeling |

---

### Q3 — Threshold applicability today

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Below all thresholds; voluntary compliance** | None beyond current posture |
| **One or more states apply now** | **Medium:** DPIA documentation (likely doc-only); possible `ops_tasks` entries for annual assessment; if CO/CT/CA DPIA triggers exist, may need internal assessment template — usually **not** product code |
| **CA applies** | **Medium–Large:** full CCPA category table in Addendum A (see Q8); possible "Do Not Sell" link in footer even if no sale |

---

### Q4 — "Sale" / "Share" under broad definitions

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Current subprocessors OK; no sale/share** | **Text only:** counsel confirms Sentry + Resend wording |
| **Sentry or analytics implicates "share"** | **Medium:** disable or further restrict Sentry PII; document in policy; possible cookie/consent banner if tracking added later |
| **Need explicit opt-out mechanism beyond GPC** | **Medium:** footer "Your Privacy Choices" link; opt-out preference center page reading `mwm_gpc_opt_out` cookie |

---

### Q5 — GPC implementation adequacy

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Detect + cookie sufficient** (no sale/share anyway) | None — current middleware stands |
| **Must suppress something when GPC set** | **Done (B9):** `readGpcOptOut.ts`; `POST /api/email-capture` skips drip + sets `unsubscribed_at`. Future analytics should reuse same helper. |
| **Full preference center required** | **Medium:** `/privacy/choices` page; persist opt-out in DB for logged-in users; sync cookie ↔ profile |

**Current gap:** cookie is **set** but **not read** anywhere. Acceptable if counsel confirms no processing to suppress.

---

### Q6 — Assess email-capture consent

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Notice + Privacy Policy link sufficient** | None — current assess block stands |
| **Explicit opt-in checkbox required** | **Small:** checkbox state on assess page; pass `marketing_consent: true` to `POST /api/email-capture`; store on `email_captures` (new column `marketing_consent_at` migration) |
| **Double opt-in required** | **Medium:** confirmation email with confirm link before drip enrollment; new API route + Resend template |

**Key files:** `app/(public)/event/[slug]/assess/page.tsx`, `app/api/email-capture/route.ts`, `supabase/migrations/*_email_captures_consent.sql`.

---

### Q7 — Self-service portability

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Manual admin JSON export within 45 days OK** | **Ops only:** document export SOP in COMPLIANCE_CALENDAR (partially done) |
| **Must be self-service / machine-readable on demand** | **Large:** `GET /api/consumer/data-export` or Settings → Download my data; generate JSON/ZIP of household data; rate limit; audit log entry |

**Key files:** new `lib/compliance/exportUserData.ts`, consumer API route, Settings UI button, possibly cron for async large exports.

---

### Q8 — California addenda completeness

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Category table + Shine the Light sufficient as drafted** | **Text only:** counsel fills category table in `privacy-policy-addenda.ts` |
| **ADMT / automated decision-making applies** | **Medium–Large:** disclosure of automated decisions; opt-out of profiling if any scoring affects users; review estate recommendations engine for "legal or similarly significant effects" |
| **Need "Do Not Sell or Share" footer link** | **Small:** `LegalFooterLinks` + `/privacy#your-rights` anchor; no backend if no sale |

---

### Q9 — Multi-state breach catch-all

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Catch-all language sufficient** | None |
| **Must enumerate state timelines** | **Text only:** expand §10 or internal runbook; optional `docs/legal/BREACH_NOTIFICATION_RUNBOOK.md` |
| **Need state-specific notification automation** | **Large:** breach workflow in admin; state-residency field on profiles; notification template matrix — unlikely at current scale |

---

### Q10 — ToS §3 residency attestation

| Counsel answer | Engineering required |
|----------------|---------------------|
| **Geo-gate + US Stripe billing sufficient** (PR #59) | None if PR #59 merged |
| **Explicit signup checkbox required** | **Medium:** signup UI checkbox; `profiles.us_residency_attested_at` + `us_residency_attestation_version` migration; block submit if unchecked |
| **Record IP country at signup** | **Small:** store `signup_ip_country` on profile or audit table (may already exist via geo middleware) |

**Related:** `lib/geo/usOnlyAccess.ts`, `app/api/auth/signup/route.ts`, PR #59.

---

## Text-only vs. code change summary

| Outcome | Counsel questions | Action |
|---------|-------------------|--------|
| **Text / policy redline only** | Q1 No, Q4 OK, Q5 detect OK, Q6 notice OK, Q7 manual OK, Q8 table fill, Q9 catch-all, Q10 geo OK | Edit `lib/legal/*.ts`, bump `PRIVACY_POLICY_VERSION`, counsel sign-off |
| **Small engineering (1–3 days)** | Q5 read cookie, Q6 checkbox, Q8 footer link, Q10 checkbox | 1–2 migrations, 2–4 files |
| **Medium engineering (1–2 weeks)** | Q1 partial, Q4 opt-out center, Q6 double opt-in, Q8 ADMT review | New routes, consent storage, preference UI |
| **Large engineering (2+ weeks)** | Q1 Yes (MHMD), Q7 self-service export, Q9 automation | New policy page, export pipeline, consent system |

---

## Versioning and launch gates

| Item | Current state | If counsel requires |
|------|---------------|---------------------|
| `PRIVACY_POLICY_VERSION` | `2026-06-20` in `privacy-policy-sections.ts` | Bump after redline; no automatic user re-acceptance today |
| `TERMS_OF_SERVICE_VERSION` | Separate flow with `terms_accepted_at` / admin backfill | Minimal ToS edits (Part 3 of draft); bump only if §3/§5/§7 change |
| Privacy re-acceptance | **Not wired** | If counsel requires: mirror terms flow — `profiles.privacy_accepted_at`, `/privacy/accept`, middleware gate |
| Migration `20260720120000` | Local only | Apply to prod before using `appealed` status |

---

## Recommended workflow after counsel review

1. Counsel returns redlined policy + written answers to Q1–Q10.
2. Engineering maps each answer using this matrix (check **Text only** vs **Small/Medium/Large**).
3. Apply text redlines in one commit; bump `PRIVACY_POLICY_VERSION`.
4. Build any required engineering from the matrix in follow-up PR(s) — do not block text redline on large items if counsel allows phased launch.
5. Apply pending migration; run compliance SOP dry-run (deny → appeal email → `appealed` status).
6. Update [DECISION_LOG.md](../DECISION_LOG.md) with counsel determinations and close open items in [COUNSEL_PRIVACY_REVIEW.md](./COUNSEL_PRIVACY_REVIEW.md).

---

## File index (privacy multi-state sprint)

| File | Role |
|------|------|
| `lib/legal/privacy-policy-sections.ts` | Main policy body |
| `lib/legal/privacy-policy-addenda.ts` | State addenda |
| `lib/privacy/globalPrivacyControl.ts` | GPC detection + cookie |
| `middleware.ts` | Attaches GPC cookie on all responses |
| `lib/email/privacyRequestDecisionEmail.ts` | Denial + appeal instructions |
| `supabase/migrations/20260720120000_privacy_requests_appealed_status.sql` | `appealed` status |
| `docs/legal/COUNSEL_PRIVACY_REVIEW.md` | Cover memo for counsel |
| `docs/legal/MWM_MultiState_Privacy_Terms_Draft.md` | Baseline draft |
| `docs/COMPLIANCE_CALENDAR.md` | Operational SOP |
