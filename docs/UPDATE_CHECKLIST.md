# Documentation Update Checklist

Use this checklist in every PR/commit routine when architecture, data flow, or tax logic changes.

## When to update docs

- Engine logic changes (`projection-complete`, `roth-analysis`, tax engines, strategy engines)
- New API routes or route behavior changes
- Database schema changes (new tables/columns/migrations/RPC signatures)
- Source-of-truth changes (e.g., table swaps, fallback removals)
- Workflow changes (advisor/consumer acceptance, recommendation writes, Monte Carlo sharing)

## Required updates before merge

- [ ] Update `docs/MASTER_ARCHITECTURE.md`
  - [ ] Current vs Target reflects actual code
  - [ ] Invariants still true
  - [ ] Key file map is accurate
  - [ ] Open backlog items are current
- [ ] Update `docs/DATABASE_SCHEMA_REFERENCE.md`
  - [ ] New/changed tables and key columns
  - [ ] Authoritative vs legacy notes
  - [ ] Relationship/lineage changes
  - [ ] Recent migrations list

## Verification pass

- [ ] `npm run build` passes
- [ ] Spot-check affected surfaces (projection/roth/strategy/domicile as applicable)
- [ ] Confirm staleness or backfill guidance is still accurate

## Commit hygiene

- [ ] Include doc updates in the same PR/commit as code changes
- [ ] Commit message mentions doc sync (architecture/schema)

