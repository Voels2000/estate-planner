# Documentation Update Checklist

Use this checklist in every PR/commit routine when architecture, data flow, or tax logic changes.

## Doc repository (start here for context)

| Doc | Purpose |
|-----|---------|
| [BUSINESS_READINESS_PLAN.md](./BUSINESS_READINESS_PLAN.md) | Washington business formation, compliance sprint summary, go-live readiness (85%) |
| [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) | Segment, personas, pricing, UX principles |
| [ROADMAP.md](./ROADMAP.md) | Sprint plan and item status |
| [NEXT_SESSION.md](./NEXT_SESSION.md) | Current sprint handoff — paste block, task list, file paths |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live checklist — SEO, domain, Resend (update at launch, not each sprint) |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled product/UX decisions — add new entries, do not edit old |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Engineering architecture |
| [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) · [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) | Consumer journeys and routes |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) | Schema authority and session history |
| [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) | Playwright vs manual smoke map |
| [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) | Human release smoke checklist |
| [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md) | Compliance language policy — education vs. advice framing |
| [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) | Sprint C-4 — auto-renewal + cancel disclosures (code complete; manual Stripe verify) |
| [LEGAL_TODO.md](./LEGAL_TODO.md) | Sprint C-5 — pre-go-live legal checklist; [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) | Sprint P-1 + P-2 — performance quick wins and pre-launch refactors |

## When to update docs

> **Sprint hygiene rule:** Add "Doc sync pass" as the final task in every sprint.
> Checklists get skipped under deadline pressure; a sprint item does not.
> At minimum, update: ROADMAP.md (sprint status), MASTER_ARCHITECTURE.md (Current vs Target),
> NEXT_SESSION.md (handoff block), and DECISION_LOG.md (any new settled decisions).

- Engine logic changes (`projection-complete`, `roth-analysis`, tax engines, strategy engines)
- New API routes or route behavior changes
- Database schema changes (new tables/columns/migrations/RPC signatures)
- Source-of-truth changes (e.g., table swaps, fallback removals)
- Workflow changes (advisor/consumer acceptance, recommendation writes, Monte Carlo sharing)
- Consumer route, profile gate, tab/sub-tab, CTA label, or save/refresh behavior → `docs/CONSUMER_FLOWS.md`
- Consumer-facing copy, disclaimers, or compliance language → `docs/UX_LANGUAGE_AUDIT_SPRINT.md` + run `bash scripts/audit-ux-language.sh`
- Schema-only session notes (no table/RPC shape change) → one line in `docs/SCHEMA_CHANGELOG.md`
- Sprint item completed or new product decision → `docs/ROADMAP.md` and/or `docs/DECISION_LOG.md` (new entry)
- End of UI sprint session → update `docs/NEXT_SESSION.md` (completed tasks, remaining work, discovered file paths)
- Launch / go-live work (robots, Search Console, domain cutover, production email, **Vercel Production env vars**, **waitlist disable**) → update `docs/LAUNCH_CHECKLIST.md` and check items there; mirror status in `ROADMAP.md` if sprint-owned
- Test data for staging smoke (attorney listing, Playwright consumer tier) → `scripts/seed-test-attorney.ts`, `scripts/seed-test-consumer-estate.ts`; document in CONSUMER_RELEASE_SMOKE_TEST.md

## Required updates before merge

- [ ] Update `docs/MASTER_ARCHITECTURE.md`
  - [ ] Current vs Target reflects actual code
  - [ ] Invariants still true
  - [ ] Key file map is accurate
  - [ ] Open backlog / migration status table still current
- [ ] Update `docs/DATABASE_SCHEMA_REFERENCE.md`
  - [ ] New/changed tables and key columns
  - [ ] Authoritative vs legacy notes
  - [ ] Relationship/lineage changes
  - [ ] Recent migrations list
- [ ] If consumer journey changed: update `docs/CONSUMER_FLOWS.md` and route row in `docs/CONSUMER_NAV_MAP.md` when URL/tier/gate changed

## Consumer flow changes (detail)

When you touch consumer UX or APIs, update in this order:

1. **Route / tier / gate / feature key** → [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md)
2. **Journey, sub-tabs, CTAs, APIs, refresh** → [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) (matching section)
3. **Schema or RPC** → [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) (+ [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) if session note only)
4. **Cross-cutting contract** → [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md)
5. **Write path or deploy smoke** → Playwright spec + [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md)

Optional: three-line header on `page.tsx` (route, tier, gate, write APIs).

## Pre-Sprint-14 gate checklist — Sprint 13 closed ✅

- [x] Acquisition & attribution smoke A–G passed (staging)
- [x] 67 migrations applied and verified
- [x] E2E 51/0/1 on staging
- [x] Test seed scripts committed and run
- [x] Supabase verification queries documented in smoke test
- [x] `INTERNAL_API_KEY` on Vercel Production
- [x] Sprint 13 launch blockers fixed (RMD copy, advisor referral trigger)

## Sprint 15 focus — closed ✅ 2026-05-24

- [x] Waitlist mode — runtime middleware redirect + docs (`3ceb125`)
- [x] LAUNCH_CHECKLIST Section 2 — domain, DNS, Resend, Search Console (Cloudflare)
- [x] Post-cutover smoke §1–3 on production
- [x] Completion log entry in LAUNCH_CHECKLIST
- [x] Sprint 15 cont. (2026-05-24) — Preview waitlist; sitemap/middleware infra bypass (`73648e5`); test cleanup (`3f732e3`); dev workflow local → preview → production
- [x] **UX Language Audit** — Sprint C-2b complete (automated grep + all `DISCLAIMER_STRINGS` surfaces wired: PDF cover, estate-tax, my-estate-strategy, footer). Manual per-surface checklist QA remains open in [UX_LANGUAGE_AUDIT_SPRINT.md](./UX_LANGUAGE_AUDIT_SPRINT.md). Run `bash scripts/audit-ux-language.sh` before any PR that touches consumer-facing strings.

| [LEGAL_TODO.md](./LEGAL_TODO.md) | Sprint C-5 — pre-go-live legal checklist; [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) (one redline, one commit) |

## Sprint P-1 focus — closed ✅ 2026-06-02

- [x] Dashboard `Promise.all`, advisor conflict cache read, recompute debounce, next/font, notification server count (`5c24160`)
- [x] Indexes `idx_assets_owner_id`, `idx_liabilities_owner_id` — applied in production
- [x] [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) + [scripts/perf-diagnostic.sql](../scripts/perf-diagnostic.sql)

## Sprint P-2 focus — closed ✅ 2026-06-02

- [x] Recommendations cache on `estate_health_scores` — recompute persists, dashboard reads cache (`47a38f3`)
- [x] Projections cache-first in `loadProjectionData` — serve `outputs_s1_first` when fresh
- [x] Layout auth dedup via `getDashboardLayoutContext` (React `cache()`)
- [x] Migration `20260602130000_sprint_p2_recommendations_cache.sql` — apply in prod before deploy
- [x] [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) § Sprint P-2

## Sprint 17 focus (current — go-live prep, non-code)

| Item | Notes |
|------|-------|
| [ ] **LEGAL_TODO.md** | Counsel handoff: §10/§11/§13 flagged, one consolidated redline; placeholders + redlines in one commit — [§ Counsel handoff](./LEGAL_TODO.md#counsel-handoff--how-to-send-the-tos) |
| [ ] **Stripe Dashboard config** | invoice.upcoming, portal cancel, receipts — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md) |
| [ ] **C-4 manual walkthrough** | Signup → paid → receipt → self-serve cancel on production |
| [ ] **Stripe production billing** | Required before opening signups |
| [ ] **Go-live day** | Supabase Auth ON → verify `/auth/callback` → `PUBLIC_SIGNUP_OPEN=true` → Core §1–3 smoke with fresh email |
| [ ] **Drip step 2 check** | `consumer21@rolobe.resend.app` |
| [x] **Sprint P-1 perf quick wins** | `5c24160` — see [PERF_SPRINT_P1.md](./PERF_SPRINT_P1.md) |
| [x] **Sprint P-2 pre-launch refactors** | `47a38f3` — recommendations cache, projections cache-first, auth dedup |

**Compliance code (C-2b–C-5):** ✅ All closed on `main` — see [NEXT_SESSION.md](./NEXT_SESSION.md) commit log.

## Sprint C-5 focus — closed ✅ 2026-06-02 (code)

- [x] **Privacy Policy** — `/privacy` (`2e1dff3`, `695a860`)
- [x] **Terms of Service** — `/terms`; post-checkout accept at `/terms/accept`
- [x] **Footer + SEO** — `LegalFooterLinks`; sitemap + robots
- [ ] **LEGAL_TODO.md** — placeholders + counsel (manual)

## Sprint C-4 focus — closed ✅ 2026-06-02 (code)

- [x] **Billing disclosures** — `lib/compliance/billing-disclosures.ts`; pre-checkout, cancel, renewal reminders (`462bda9`)
- [ ] **Manual Stripe walkthrough** — [BILLING_DISCLOSURES_SPRINT.md](./BILLING_DISCLOSURES_SPRINT.md)

## Sprint 16 focus — closed ✅ 2026-05-24

- [x] **Sprint C-2b UX Language Audit** — all `DISCLAIMER_STRINGS` surfaces wired (`788aa08`); `audit-ux-language.sh` 0 findings
- [x] **Sprint C-3 RLS + auth/security** — RLS (`236890c`); auth callback, MFA, headers (`56a4407`); push RLS migration to prod if not applied
- [x] Billing + legal pages — C-4 code (`462bda9`); C-5 code (`2e1dff3`, `695a860`); manual verify remains

## Pre-Sprint-15 go-live env vars — closed ✅ 2026-05-24

Verified in **Vercel → Production**:

- [x] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`
- [x] `RECOMPUTE_SECRET`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `CRON_SECRET` — all set
- [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — confirmed
- [x] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → **not needed** (Cloudflare Search Console verification)
- [ ] **Open signups:** `PUBLIC_SIGNUP_OPEN=true` → Sprint 17 go-live day (after legal + C-4 manual verify)

Full table: [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-sprint-15-go-live--verified-2026-05-24).

## Verification pass

Use this for **all** merges. For **tax/engine** changes, also run the extra spot-checks in [MASTER_ARCHITECTURE.md → Release verification](./MASTER_ARCHITECTURE.md#release-verification).

- [ ] `npm run build` passes
- [ ] Spot-check affected surfaces (projection/roth/strategy/domicile as applicable)
- [ ] Confirm staleness or backfill guidance is still accurate
- [ ] After deploy: optional [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (~10 min core)

## Commit hygiene

- [ ] Include doc updates in the same PR/commit as code changes
- [ ] Commit message mentions doc sync (architecture/schema/flows)
