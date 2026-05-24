# NEXT_SESSION.md
# Sprint 17 — Session Start Document
# Updated: 2026-06-02 (Sprint F-1 import)

---

## Paste this as your FIRST MESSAGE in Cursor

> My Wealth Maps — **Sprint 17 (go-live prep).** Compliance C-2b → C-5, **Sprint P-1 + P-2 perf**, **Sprint F-1 import**, and education nav fixes on `main`. Waitlist active. **No code blockers** for open signups — remaining work is legal review, Stripe/Supabase Dashboard config, and go-live day ops.
>
> **Before flip:** [LEGAL_TODO.md](./LEGAL_TODO.md) — send ToS to counsel with §10/§11/§13 flagged; one consolidated redline; batch placeholder find-and-replace with redlines in one commit; email aliases; Stripe Dashboard (invoice.upcoming, portal cancel, receipts).
>
> **Go-live day order:** [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip) — Supabase Auth ON → verify `/auth/callback` on staging → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke with fresh email.

---

## Compliance sprints — all closed ✅ (code complete)

| Sprint | Scope | Commit(s) | Status |
|--------|-------|-----------|--------|
| **C-2b** | UX language audit — 32 findings → 0 | `788aa08` | ✅ |
| **C-3** | RLS fixes (`236890c`); auth callback, MFA, security headers, PII logging (`56a4407`); Monte Carlo UX + docs (`cda2ccc`); audit artifacts gitignored (`d854c05`) | `236890c`, `56a4407`, `cda2ccc`, `d854c05` | ✅ |
| **C-4** | Billing disclosures — RCW 19.316, FTC Negative Option, renewal reminders | `462bda9` | ✅ code — manual Stripe walkthrough remains |
| **C-5** | Privacy Policy (`/privacy`), Terms of Service (`/terms`), footer links, sitemap | `2e1dff3`, `695a860` | ✅ — legal review + TODO placeholders remain |

**Audit scripts (must stay 0):** `bash scripts/audit-ux-language.sh` · `bash scripts/security-audit.sh`

---

## Sprint P-1 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Dashboard Promise.all** | Parallelized sequential block — ~200–400ms TTFB improvement |
| **Advisor conflict cache read** | Removed `detectConflicts()` write-on-read on advisor client page |
| **Recompute debounce** | 3s per `householdId` in `triggerEstateHealthRecompute.ts` |
| **Notification count** | Server-fetched in layout; client refresh on panel actions only |
| **next/font** | Self-hosted Playfair Display + DM Sans (no CDN) |
| **Indexes (prod applied)** | `idx_assets_owner_id`, `idx_liabilities_owner_id` |

**Commit:** `5c24160` · **Doc:** [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) · **Diagnostics:** [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

---

## Sprint P-2 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Recommendations cache** | `estate_health_scores.recommendations` jsonb; persisted during recompute; dashboard reads cache (no RPC on load) |
| **Projections cache-first** | `loadProjectionData` serves fresh `outputs_s1_first`; skips 11-query load + `computeCompleteProjection` when not stale |
| **Auth dedup** | `getDashboardLayoutContext` via React `cache()` — one profile+household+notifications load per request in layout |

**Commit:** `47a38f3` · **Migration:** `20260602130000_sprint_p2_recommendations_cache.sql` — apply in prod before deploy if not already applied · **Doc:** [PERF_SPRINT_P1.md § Sprint P-2](./PERF_SPRINT_P1.md#sprint-p-2--pre-launch-refactors)

**Remaining post-launch perf:** Materialize `calculate_estate_composition` at recompute (recommendations done; composition still on-demand on some surfaces).

---

## Education nav fix ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Double sticky nav** | Skip marketing `PublicNav`/footer on `/education/*`; education header only |
| **Unpublished modules** | `getEducationModule()` returns null → 404 (was reachable by direct URL) |
| **Decision tree** | Suggested learning paths link to real module URLs |
| **Link validation** | `scripts/validate-education-links.mjs` — run after content changes |

**Commits:** `a138608` (public access), `b41719f` (sidebar link), education nav fix (this session)

**Post-deploy:** `EDUCATION_LINK_BASE_URL=https://mywealthmaps.com node scripts/validate-education-links.mjs`

---

## Sprint F-1 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Parse API** | `POST /api/ingest` — CSV/XLSX only; auto-detect table + field mapping |
| **Commit** | `POST /api/import/commit` (existing); client URL mismatch fixed |
| **Schema** | `ingestion_jobs` table + RLS — migration `20260602140000_sprint_f1_ingestion_jobs.sql` |
| **Tier gate** | `/import` aligned to tier 2 (`hasFeatureAccess('import', …)`) |
| **Templates** | `public/templates/import-sample*.csv` |

**Commit:** `d3400b1` · **Apply migration manually** before testing import in production.

**Smoke:** Tier 2+ → `/import` → upload assets template → review mapping → commit → verify rows in `assets`.

---

## Sprint 17 — remaining (non-code)

| Item | Owner | Blocks open signups? |
|------|-------|----------------------|
| **LEGAL_TODO.md** — replace TODO placeholders (entity name, address, registered agent) | You | **Yes** |
| **Email aliases** — privacy@, security@, legal@ | You | **Yes** |
| **Counsel sign-off** — ToS §10 (disclaimers), §11 (liability cap), §13 (arbitration) | Counsel | **Yes** |
| **Stripe Dashboard** — invoice.upcoming webhook, Customer Portal cancel, receipt emails | You | **Yes** (manual verify) |
| **Stripe production billing** | You | **Yes** |
| **Supabase Auth** — email confirm ON, secure email change ON, min password 12 | You | Go-live day |
| **`PUBLIC_SIGNUP_OPEN=true`** + redeploy | You | Go-live day |
| **Core §1–3 smoke** — fresh email; signup → confirm → login → dashboard | You | Go-live day |
| **Drip step 2 check** | Ops | No — `consumer21@rolobe.resend.app` |

**Counsel handoff:** Send ToS with §10/§11/§13 flagged; ask for **one consolidated redline**. Apply redlines + TODO placeholder find-and-replace in **one final commit** before go-live — see [LEGAL_TODO.md § Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos).

### Go-live gate (exact order)

**Pre-flip (legal + config):** See [LEGAL_TODO.md](./LEGAL_TODO.md) and [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) manual checklist.

**Go-live day:** [LAUNCH_CHECKLIST.md § Opening signups — go-live flip](./LAUNCH_CHECKLIST.md#opening-signups--go-live-flip):

1. Supabase Dashboard → email confirmations ON, secure email change ON, min password **12**
2. Verify `/auth/callback` + signup → confirm-email flow on **staging** (code on `main` since `56a4407`)
3. Vercel Production → `PUBLIC_SIGNUP_OPEN=true` → redeploy
4. Core §1–3 smoke on production ([CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)) with **fresh email**

**Note:** Supabase Auth dashboard switches stay **OFF** until go-live day — test accounts and seed scripts depend on current settings.

---

## Sprint 16 closed ✅

| Area | Outcome |
|------|---------|
| **Sprint C-2b UX Language Audit** | ✅ Complete — all `DISCLAIMER_STRINGS` surfaces wired; `audit-ux-language.sh` 0 findings (`788aa08`) |

**Commits:** `788aa08`

---

## Sprint C-3 closed ✅ (2026-06-02)

| Phase | Outcome | Commits |
|-------|---------|---------|
| **Phase 1 — RLS** | `20260602000000_sprint_c3_rls_fixes.sql` | `236890c` |
| **Phase 1b + Phase 3 — Auth/security** | `/auth/callback`, confirm-email, MFA middleware, security headers, PII logging, welcome route auth | `56a4407` |
| **Docs + Monte Carlo UX** | Master doc sync, Monte Carlo insight strings | `cda2ccc` |
| **Hygiene** | Audit artifacts gitignored | `d854c05` |

---

## Sprint C-4 closed ✅ (code)

| Area | Outcome |
|------|---------|
| **Billing disclosures** | `lib/compliance/billing-disclosures.ts`; pre-checkout on billing/pricing; cancel flow; `invoice.upcoming` renewal reminder | `462bda9` |

**Manual remaining:** Stripe Dashboard config + production walkthrough — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

---

## Sprint C-5 closed ✅ (2026-06-02)

| Area | Outcome |
|------|---------|
| **Privacy Policy** | `/privacy` — WCPA structure; TODO placeholders for entity/address/agent | `2e1dff3`, `695a860` |
| **Terms of Service** | `/terms` — RCW 19.316 billing terms; post-checkout accept at `/terms/accept` | `2e1dff3`, `695a860` |
| **Footer / SEO** | `LegalFooterLinks` on public + dashboard; sitemap + robots | `2e1dff3`, `695a860` |

**Manual remaining:** [LEGAL_TODO.md](./LEGAL_TODO.md)

---

## Sprint 15 closed ✅

| Area | Outcome |
|------|---------|
| **Domain / DNS / SSL** | `mywealthmaps.com` live (2026-05-24) |
| **Vercel Production env vars** | Verified (2026-05-24) |
| **Search Console** | Verified via Cloudflare domain provider; sitemap submitted (2026-05-24) |
| **Resend domain** | `mywealthmaps.com` verified (2026-05-24) |
| **Waitlist mode** | Active on Production (`middleware.ts`, `3ceb125`); Preview enabled (2026-05-24) |
| **Post-cutover smoke §1–3** | Passed on production (2026-05-24) |
| **Sitemap / crawl infra** | Middleware bypass for `/sitemap.xml`, `/robots.txt`, `/_next/`, `/api/` (`73648e5`) |
| **Test account cleanup** | `scripts/cleanup-test-accounts.ts` (`3f732e3`) |
| **Dev workflow** | local → preview → production |

**Commits:** `7afaedb`, `bb9a191`, `3ceb125`, `729d411`, `b97f945`, `3f732e3`, `73648e5`

### Dev deploy workflow (2026-05-24)

1. **Local** — `npm run dev` with `.env.local`
2. **Preview** — push branch → Vercel preview (`estate-planner-gules.vercel.app`); set `WAITLIST_MODE=true` on Preview to match production gating
3. **Production** — merge to `main` → `mywealthmaps.com`; flip `PUBLIC_SIGNUP_OPEN=true` on go-live day per checklist

---

## Sprint 14 closed ✅

| Area | Outcome |
|------|---------|
| **Manual smoke §1–3** | Passed 2026-05-23 |
| **Manual smoke §4–7** | Passed 2026-05-23 |
| **Manual smoke §8, §11** | Passed 2026-05-23 |
| **§9 advisor recommendation** | Skipped — needs linked advisor |
| **§10 Gifting/Strategies/Trusts** | E2E 19/19 confirmed |
| **§2.4 recompute automated** | consumer-core-recompute.spec.ts (`93aa6f5`) |
| **Admin Portal bug** | Fixed `f4e9160` |
| **Asset modal bug** | Fixed `f4e9160` |
| **E2E** | 41 passed; 12 staging-flaky (19/19 with `--workers=1`) |
| **Commits** | `93aa6f5`, `1e092d7`, `f4e9160` |

### Known staging E2E behaviour (do not lose)

`consumer-strategy-writes` and `dashboard` specs fail under parallel workers on staging — Supabase statement timeouts (`57014`) and `net::ERR_ABORTED`. Always re-run failures with `--workers=1` before treating as regressions. Production DB will not have this contention.

---

## Test account references

| Role | Email | Notes |
|------|-------|-------|
| **Consumer** | `david@rolobe.resend.app` | Estate tier, active subscription, is_superuser: false |
| **Advisor (Playwright)** | `advisor2@rolobe.resend.app` | `seed-michael-johnson-advisor-demo.ts` |
| **Attorney (portal login)** | `test-attorney-portal@rolobe.resend.app` | Password: `TestAttorney123!` · `seed-test-attorney.ts` links `profile_id` for `/attorney` newsletter kit |
| **Attorney (test listing)** | `test-attorney@mywealthmaps.test` | Listing email · `aref`: **6fd027d3** |
| **Advisor (test listing)** | `test-advisor@mywealthmaps.test` | `ref`: **c91dcd1b** |

### Resend production test inboxes (`@rolobe.resend.app`)

Disposable addresses for production waitlist / drip captures. Inbound forwards via `app/api/resend/inbound/route.ts`. Cleanup stray signup accounts: `scripts/cleanup-test-accounts.ts`.

| Email | Notes |
|-------|-------|
| `consumer21@rolobe.resend.app` | Drip step 2 check (when running drip smoke) |

### Seed scripts (idempotent)

```bash
set -a && source .env.local && source .env.test && set +a
npx tsx scripts/seed-test-advisor.ts
npx tsx scripts/seed-test-attorney.ts
npx tsx scripts/seed-test-consumer-estate.ts
```

### Run E2E (always source env first)

```bash
set -a && source .env.local && source .env.test && set +a
npx playwright test tests/e2e/consumer --project=consumer
# If failures: re-run with --workers=1 before investigating
npx playwright test [failing spec] --project=consumer --workers=1
```

---

## Known limitations (do not lose between sessions)

### Anonymous cross-device attribution

`referral_clicks` has **no `user_id`** — clicks are logged anonymously at event-page visit (`POST /api/referral/track`). Per-user attribution at signup uses `funnel_events` and `profiles.referral_code` / `attorney_referral_code` from sessionStorage.

**Edge case:** Visit with `?ref=` on device A, signup on device B without sessionStorage — weak funnel match. Not a launch blocker.

### Advisor connection status — canonical import

```ts
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
```

Statuses: `active`, `accepted`. Do not hardcode status strings.

### Planning empty-state CTAs (do not regress)

- **`/projections`, `/complete`:** `PLANNING_MISSING_PROJECTION_ACTIONS_TIER2` only
- **`/my-estate-strategy` (tier 3):** `POST /api/consumer/generate-base-case`
- Do **not** merge TIER2 and TIER3 lists — `lib/planning/planningEmptyState.ts`

### Legal pages vs in-app terms accept

- **Public ToS:** `/terms` — full Terms of Service (Sprint C-5)
- **Post-checkout accept:** `/terms/accept` — dynamic `app_config.terms_sections` + accept button (sync with `/terms` after legal review per [LEGAL_TODO.md](./LEGAL_TODO.md))
