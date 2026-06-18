# Negative-Authorization Test Plan (B2B2C Cross-Tenant Isolation)

**Goal:** Prove that no actor can read or mutate data they don't own across the consumer / advisor / attorney boundary. RLS *policies existing* is not the same as *isolation proven*. This plan tests failure modes at two layers — app/route and the RLS backstop — plus a structural CI invariant so an un-policied `household_id` table cannot ship silently.

**Canonical table list:** `lib/authz/householdScopedTables.ts` (keep in sync with `scripts/verify-rls-invariants.sql`).

---

## 1. Authorization model

- **Consumer** owns one or more `households`; full CRUD on own rows; zero visibility into any other household.
- **Advisor** reads/writes only households linked via `advisor_clients` (`status` active/accepted); loses access when link is revoked.
- **Attorney** reads only households assigned in `attorney_clients` (`client_id` = `households.id`); no write to consumer financial rows.
- **Cross-advisor / cross-attorney:** never see another professional's book.
- **Privilege direction:** consumer cannot reach advisor/attorney-only routes; lower tier cannot exceed cap.

**Link tables:**
- `advisor_clients` — `advisor_id` → advisor profile; `client_id` → **household owner** profile id (not `households.id`).
- `attorney_clients` — `attorney_id` → `attorney_listings.id`; `client_id` → **`households.id`**.

**Owner-scoped financial rows** (`assets`, `liabilities`, `businesses`, `real_estate`, `insurance`, `asset_beneficiaries`) use `owner_id`, not `household_id` — JWT isolation checked separately in `verify:rls`.

---

## 2. Test matrix

E2E tenants (seeded by `npm run seed:e2e`):

| Persona | Identity | Household |
|---------|----------|-----------|
| Consumer A | `e2e-consumer@mywealthmaps.test` | `PLAYWRIGHT_HOUSEHOLD_ID` |
| Consumer B | `e2e-advisor-client@mywealthmaps.test` | `PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID` |
| Advisor X (linked) | `e2e-advisor@mywealthmaps.test` | linked to B only |
| Advisor Y (unlinked) | `e2e-advisor-empty@mywealthmaps.test` | zero clients |
| Attorney P | `e2e-attorney@mywealthmaps.test` | linked to A when seeded |

| # | Actor | Target | Operation | Expected |
|---|-------|--------|-----------|----------|
| 1 | Consumer A | Consumer B household + child rows | read | empty / 403 |
| 2 | Consumer A | Consumer B household | update / delete | denied |
| 3 | Advisor Y | Advisor X client (B) | read | empty / 403 |
| 4 | Advisor X | Consumer A (unlinked) | read | empty / 403 |
| 5 | Advisor X (link revoked) | formerly-linked household | read | empty / 403 |
| 6 | Attorney P | unassigned household | read | empty / 403 |
| 7 | Consumer A | advisor-only route | read | 403 |
| 8 | Any actor | foreign export (`/api/advisor/client-export-payload`) | generate | 404 |
| 9 | Any non-admin | `/api/admin/verify-env` | call | 404 |
| 10 | Attorney P | foreign financial write | write | denied |

---

## 3. Layer 1 — RLS backstop (`npm run verify:rls`)

PostgREST JWT isolation in `lib/verify/runRlsVerification.ts`:

- Consumer JWT cannot read foreign `owner_id` on `assets`
- Consumer JWT cannot read foreign `household_id` on each table in `HOUSEHOLD_SCOPED_TABLES`
- `lifetime_exemption_summary` view denied for anon + authenticated

Structural invariant in `scripts/verify-rls-invariants.sql` check `household_id_table_missing_rls`: every public table with a `household_id` column must have RLS enabled and ≥1 policy.

Structural coverage gate in `scripts/assert-rls-coverage.sql`: any table with a tenancy column (`household_id`, `user_id`, `owner_id`, `advisor_id`, `attorney_id`, `client_id`) must not have missing RLS, zero policies, permissive `USING (true)` / `WITH CHECK (true)` reachable by `public`/`anon`/`authenticated`, or a policy named like "service role …" not granted `TO service_role`. Reference allowlist: `state_estate_tax_content`, `state_estate_tax_rules`.

---

## 4. Layer 2 — Route/API (`test:e2e:security-isolation`)

`tests/e2e/security/cross-household-isolation.spec.ts` — consumer/advisor IDOR on gifting, composition, export, documents, advisor export payload.

`tests/e2e/security/route-authz.spec.ts` — admin verify-env, consumer on advisor routes (`@authz` `@production`).

---

## 5. Definition of done

- [x] Layer-1 RLS spot-check for all `HOUSEHOLD_SCOPED_TABLES` (verify:rls JWT loop)
- [x] Layer-2 route spec covers reads, exports, admin
- [x] `household_id_table_missing_rls` invariant gates `verify:rls` / `release:preflight`
- [x] `@authz` subset in `test:e2e:prod:smoke` (via `@production` tag)
- [x] Revoked-link lifecycle test (seed `advisor_clients.status` inactive row)
- [x] Attorney cap-at-assignment test (`tests/unit/attorneyClientCap.spec.ts`)
- [x] Full per-table JWT matrix for every `HOUSEHOLD_SCOPED_TABLES` entry (`verify:rls`)

---

## 6. Commands

```bash
npm run seed:e2e
npm run verify:rls
npm run test:e2e:security-isolation -- --workers=1
npm run test:e2e:prod:smoke -- --grep @authz --workers=1
npm run release:preflight   # includes verify:rls
```

**CI:** When `E2E_SMOKE_IN_CI=true`, the `e2e-smoke` workflow runs `test:e2e:security-isolation` on every PR to `main` (20 tests, staging Supabase + localhost app).
