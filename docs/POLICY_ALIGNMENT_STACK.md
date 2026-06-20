# Policy ↔ code alignment stack (PRs #60–#70)

**Last updated:** 2026-06-18  
**Target branch:** `staging` (merge in order; each PR is stacked on the previous)  
**Counsel status:** Privacy/ToS text is an engineering draft — counsel redline still pending before public launch.

---

## Merge order (stack)

| Order | PR | Branch | Batch | Depends on |
|------:|----|--------|-------|------------|
| 1 | [#60](https://github.com/Voels2000/estate-planner/pull/60) | `feat/multi-state-privacy` | Multi-state privacy | `staging` |
| 2 | [#61](https://github.com/Voels2000/estate-planner/pull/61) | `chore/policy-alignment-softening` | A — policy text softening | #60 |
| 3 | [#62](https://github.com/Voels2000/estate-planner/pull/62) | `feat/self-serve-account-deletion` | B1 — self-serve delete | #61 |
| 4 | [#63](https://github.com/Voels2000/estate-planner/pull/63) | `fix/waitlist-privacy-notice` | B2 — waitlist notice | #62 |
| 5 | [#64](https://github.com/Voels2000/estate-planner/pull/64) | `fix/eligibility-attestation` | B3 — 18+/US attestation | #63 |
| 6 | [#65](https://github.com/Voels2000/estate-planner/pull/65) | `fix/attorney-billing-disclosures` | B4 — attorney billing copy | #64 |
| 7 | [#66](https://github.com/Voels2000/estate-planner/pull/66) | `fix/trial-disclosure-copy` | B5 — trial checkout copy | #65 |
| 8 | [#67](https://github.com/Voels2000/estate-planner/pull/67) | `feat/appeals-sla-tracking` | B6 — appeals 60-day SLA | #66 |
| 9 | [#68](https://github.com/Voels2000/estate-planner/pull/68) | `chore/remove-dead-renewal-cron` | B7 — renewal cron cleanup | #67 |
| 10 | [#69](https://github.com/Voels2000/estate-planner/pull/69) | `fix/terms-single-source` | B8 — ToS single source | #68 |
| 11 | [#70](https://github.com/Voels2000/estate-planner/pull/70) | `feat/gpc-marketing-respect` | B9 — GPC marketing drip | #69 |

After each merge, retarget the next PR to `staging` (GitHub may offer “Update branch” automatically).

---

## Migrations

| Migration | Staging | Production | Required before code |
|-----------|---------|------------|----------------------|
| `20260720120000_privacy_requests_appealed_status.sql` | ✅ applied 2026-06-18 | ⬜ **pending** | **#67 (B6)** — admin `appealed` status, denial email appeal path |
| `20260721120000_privacy_requests_appeal_due_at.sql` | ✅ applied 2026-06-18 | ⬜ **pending** | **#67 (B6)** — `appeal_due_at`, compliance cron appeal alerts |

All other batches (#60–#65, #68–#70) are **code-only** — no new schema.

### Staging apply (done)

```bash
bash scripts/apply-migration.sh staging supabase/migrations/20260720120000_privacy_requests_appealed_status.sql
bash scripts/apply-migration.sh staging supabase/migrations/20260721120000_privacy_requests_appeal_due_at.sql
```

### Production apply — **before or with staging→main promotion**

Apply **both** migrations on production **before** merging code that uses `appealed` / `appeal_due_at` to `main`:

```bash
bash scripts/apply-migration.sh production supabase/migrations/20260720120000_privacy_requests_appealed_status.sql
bash scripts/apply-migration.sh production supabase/migrations/20260721120000_privacy_requests_appeal_due_at.sql
```

Order matters: `20260720120000` before `20260721120000`.

Verify:

```sql
-- appealed in status check
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'privacy_requests_status_check';
-- appeal_due_at column
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'privacy_requests' AND column_name = 'appeal_due_at';
```

---

## Per-PR smoke (minimal)

| PR | Spot-check |
|----|------------|
| #60 | `/privacy` renders v2026-06-20; GPC cookie on `Sec-GPC: 1`; admin privacy PATCH `denied` sends email |
| #61 | Privacy version `2026-06-21`; GPC declarative §11; manual fulfillment §7 |
| #62 | Settings → Security → Delete account; 409 if active sub |
| #63 | `/waitlist` shows privacy notice before email field |
| #64 | Signup checkbox includes 18+ / U.S. resident |
| #65 | `/attorney/billing` shows `preCheckout()` disclosures |
| #66 | Estate trial tier shows full billing disclosure on `/billing` + `/pricing` |
| #67 | Admin privacy → set `appealed` → `appeal_due_at` populated; compliance cron includes appeals |
| #68 | Notifications cron no longer queries `subscription_renewal_date` |
| #69 | Admin Terms read-only; Re-gate users works; `/terms` unchanged |
| #70 | Email capture with GPC → no drip step 1; `unsubscribed_at` set |

---

## Production promotion checklist

When promoting this stack from `staging` → `main`:

1. [ ] Counsel redline complete (privacy + ToS) — **do not flip to public users without this**
2. [ ] Apply **both** pending migrations on production (see above)
3. [ ] Merge stack to `main` (or merge `staging` after full stack on staging)
4. [ ] Confirm Vercel production deploy green
5. [ ] Post-deploy: privacy request denial → appeal email; assess GPC browser → no drip

See also [PROMOTION_STAGING_TO_MAIN.md](./PROMOTION_STAGING_TO_MAIN.md) § Policy alignment stack.
