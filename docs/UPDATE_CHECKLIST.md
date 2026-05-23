# Documentation Update Checklist

Use this checklist in every PR/commit routine when architecture, data flow, or tax logic changes.

## Doc repository (start here for context)

| Doc | Purpose |
|-----|---------|
| [PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md) | Segment, personas, pricing, UX principles |
| [ROADMAP.md](./ROADMAP.md) | Sprint plan and item status |
| [NEXT_SESSION.md](./NEXT_SESSION.md) | Current sprint handoff — paste block, task list, file paths |
| [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) | Go-live checklist — SEO, domain, Resend (update at launch, not each sprint) |
| [DECISION_LOG.md](./DECISION_LOG.md) | Settled product/UX decisions — add new entries, do not edit old |
| [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) | Engineering architecture |
| [CONSUMER_FLOWS.md](./CONSUMER_FLOWS.md) · [CONSUMER_NAV_MAP.md](./CONSUMER_NAV_MAP.md) | Consumer journeys and routes |
| [DATABASE_SCHEMA_REFERENCE.md](./DATABASE_SCHEMA_REFERENCE.md) · [SCHEMA_CHANGELOG.md](./SCHEMA_CHANGELOG.md) | Schema authority and session history |

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
- Schema-only session notes (no table/RPC shape change) → one line in `docs/SCHEMA_CHANGELOG.md`
- Sprint item completed or new product decision → `docs/ROADMAP.md` and/or `docs/DECISION_LOG.md` (new entry)
- End of UI sprint session → update `docs/NEXT_SESSION.md` (completed tasks, remaining work, discovered file paths)
- Launch / go-live work (robots, Search Console, domain cutover, production email, **Vercel Production env vars**) → update `docs/LAUNCH_CHECKLIST.md` and check items there; mirror status in `ROADMAP.md` if sprint-owned
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

## Sprint 14 focus (current)

- [ ] CONSUMER_RELEASE_SMOKE_TEST Core sections 1–3
- [ ] Estate planning sections 4–7
- [ ] LAUNCH_CHECKLIST Section 1 fully checked
- [ ] No new features / no new migrations without sign-off

## Pre-Sprint-15 go-live env vars (ops — no code)

Before domain cutover, verify in **Vercel → Production**:

- [ ] `NEXT_PUBLIC_APP_URL` → `https://mywealthmaps.com`
- [ ] `RECOMPUTE_SECRET`, `RESEND_API_KEY`, `INTERNAL_API_KEY`, `CRON_SECRET` — all set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — confirmed
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — set at launch
- [ ] Redeploy after env changes; run Core smoke (~10 min)

Full table: [LAUNCH_CHECKLIST.md § Vercel Production env vars](./LAUNCH_CHECKLIST.md#vercel-production-env-vars-required-before-sprint-15-go-live).

## Verification pass

Use this for **all** merges. For **tax/engine** changes, also run the extra spot-checks in [MASTER_ARCHITECTURE.md → Release verification](./MASTER_ARCHITECTURE.md#release-verification).

- [ ] `npm run build` passes
- [ ] Spot-check affected surfaces (projection/roth/strategy/domicile as applicable)
- [ ] Confirm staleness or backfill guidance is still accurate
- [ ] After deploy: optional [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (~10 min core)

## Commit hygiene

- [ ] Include doc updates in the same PR/commit as code changes
- [ ] Commit message mentions doc sync (architecture/schema/flows)
