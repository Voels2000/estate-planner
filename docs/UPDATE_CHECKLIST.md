# Documentation Update Checklist

Use this checklist in every PR/commit routine when architecture, data flow, or tax logic changes.

## When to update docs

- Engine logic changes (`projection-complete`, `roth-analysis`, tax engines, strategy engines)
- New API routes or route behavior changes
- Database schema changes (new tables/columns/migrations/RPC signatures)
- Source-of-truth changes (e.g., table swaps, fallback removals)
- Workflow changes (advisor/consumer acceptance, recommendation writes, Monte Carlo sharing)
- Consumer route, profile gate, tab/sub-tab, CTA label, or save/refresh behavior → `docs/CONSUMER_FLOWS.md`
- Schema-only session notes (no table/RPC shape change) → one line in `docs/SCHEMA_CHANGELOG.md`

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

## Verification pass

Use this for **all** merges. For **tax/engine** changes, also run the extra spot-checks in [MASTER_ARCHITECTURE.md → Release verification](./MASTER_ARCHITECTURE.md#release-verification).

- [ ] `npm run build` passes
- [ ] Spot-check affected surfaces (projection/roth/strategy/domicile as applicable)
- [ ] Confirm staleness or backfill guidance is still accurate
- [ ] After deploy: optional [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md) (~10 min core)

## Commit hygiene

- [ ] Include doc updates in the same PR/commit as code changes
- [ ] Commit message mentions doc sync (architecture/schema/flows)
