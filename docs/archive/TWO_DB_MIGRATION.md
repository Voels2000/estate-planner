# EXECUTED 2026-06-13 — repo bundle committed in associated PR; live steps (Preview repoint, prod cleanup, canary seed) attested by Al, not repo-verifiable.

**Steady state:** [DEPLOYMENT.md](../DEPLOYMENT.md)

---

# TWO_DB_MIGRATION.md — split staging from production

**Status:** EXECUTED 2026-06-13 — repo bundle in associated PR; live dashboard steps attested by Al, not repo-verifiable.

One-time migration runbook. After it's executed and verified, archive this file;
`DEPLOYMENT.md` then describes the permanent two-DB steady state.

**What this achieves:** a disposable **staging** Supabase (used by local + Vercel Preview)
for all multi-role testing, and a clean **production** Supabase holding only real clients +
your superuser + one consumer canary for E2E smoke. Purge becomes staging-only; prod is
never wiped again.

---

## PART 0 — Inputs (LOCKED)

| Input | Value | Notes |
|---|---|---|
| Real client (protect) | `david@gmail.com` | genuine client |
| Superuser (protect) | `avoels@comcast.net` | MFA-protected, manual-only |
| Prod consumer canary | `canary-consumer@mywealthmaps.com` | synthetic, fresh data, E2E smoke target |
| Canary password | Vercel **Production** secret `E2E_CANARY_PASSWORD` | never in GitHub, never committed |
| Staging project name | `mwm-staging` | new free-tier Supabase project |
| Staging role cast | consumer, superuser, advisor, consumer↔advisor link, attorney | via `npm run seed:e2e` |
| Prod DB URL | _(local only — dashboard connection string)_ | backup + cleanup dry-run |
| Staging DB URL | _(after Phase A)_ | — |

**Confirmed DELETE from prod (Phase F execute — manual only):**

- `avoels@outlook.com`
- `stephen.a.voels@sbcglobal.net` / `Stephen.a.voels@sbcglobal.net`
- All `@mywealthmaps.test`, all `@rolobe.resend.app`, and every other synthetic row

**Email normalization:** Supabase lowercases emails on signup. All scripts use lowercase canonical spelling.

**Policy:** Do **not** put `SUPABASE_DB_URL` in Vercel. Local only. Cursor never runs prod delete (Phase F execute).

---

## PART 1 — The plan

### End state (what "done" looks like)

- **Staging Supabase** (new, free-tier project): full synthetic cast, all roles, full data. Wipe-able. MFA off. Used by local dev + Vercel Preview.
- **Production Supabase** (existing): exactly **three** protected rows —
  1. `david@gmail.com` (real client)
  2. `avoels@comcast.net` (superuser/admin, MFA on, manual-only)
  3. `canary-consumer@mywealthmaps.com` (synthetic canary, full data, E2E target)
  Every other synthetic row deleted, once.
- **E2E split:** full suite runs against **staging**; **canary-smoke subset** runs against **prod**. Privileged/multi-role paths are a staging concern only (prod superuser can't be smoked headlessly through MFA — by design).
- **Purge rule:** `cleanup:purge` targets staging only, forever.

### Who does what — at a glance

| Phase | Work | Cursor | Manual (you) |
|---|---|---|---|
| A. Create staging project | provision Supabase | — | ✅ dashboard |
| B. Schema parity | dump prod schema → apply to staging → diff | ✅ writes + runs | provide DB URLs |
| C. Repoint env | local + Preview → staging; prod stays prod | updates `.env.example` | ✅ Vercel dashboard + `.env.local` |
| D. Build staging cast | seed scripts (all roles, full data) + run | ✅ | — |
| E. Build prod canary | admin-create + confirm + seed script | ✅ writes | ✅ run vs prod; password→Vercel |
| F. Prod cleanup | keep-list + dry-run + backup + delete | ✅ writes + runs **dry-run** | ✅ **backup + execute delete** |
| G. E2E split + keep-alive | staging full suite, prod canary smoke, ping workflow | ✅ | — |
| H. Lock + docs + archive | purge-staging-only, update docs | ✅ | — |

The only irreversible step is **F's delete**. Cursor prepares and dry-runs it; you
back up, eyeball the row list, and execute. Cursor must never run the prod delete.

### Phase order (do not reorder)

A → B → C → D → E → F → G → H. Staging must exist and have prod's schema (A,B) before
anything seeds into it (D). The prod canary (E) must exist and be verified before the
prod cleanup (F) — otherwise the cleanup could delete the only account E2E can log into.

---

## PART 2 — Cursor execution script

Each prompt follows the usual pattern: Phase 0 grep/read → confirm → implement → verify →
atomic commit. Hard STOPs mark manual steps. Master docs
(`MASTER_ARCHITECTURE`, `CALCULATION_ENGINES`, `DECISION_LOG`, `ROADMAP`) are never touched.

### ⛔ MANUAL — Phase A (do this yourself, then continue)

In the Supabase dashboard: create a new project (free tier) named `mwm-staging`.
Copy its URL, anon key, service-role key, and DB connection string into Part 0.
Add a keep-alive later (Phase G) so it doesn't pause after 7 days idle.

### Phase B — Schema parity (Cursor)

```
Phase 0 — READ ONLY.
1. Locate migration + schema tooling: git ls-files | grep -iE 'supabase/(migrations|config)'
2. Confirm how schema is currently managed (supabase CLI? raw SQL?). Report.
STOP. Confirm with me which DB URLs to use (PROD_DB_URL, STAGING_DB_URL — I'll provide).

--- After I confirm + provide URLs: ---
3. Dump PRODUCTION schema as the source of truth (NOT just repo migrations — prod has
   drifted before; remember the pg_get_functiondef lesson):
   pg_dump "$PROD_DB_URL" --schema-only --no-owner --no-privileges > /tmp/prod_schema.sql
   Also dump function definitions explicitly to catch RPC drift.
4. Apply that schema to STAGING:
   psql "$STAGING_DB_URL" -f /tmp/prod_schema.sql
5. Diff to prove parity: dump staging schema, diff against prod schema, report any deltas.
   Do NOT proceed if functions/RLS policies differ — staging must match what users run.
6. Report file paths + the diff result. No commit needed (no repo files changed) unless
   you generated a baseline migration — if so, commit it:
   git commit -m "chore(db): staging schema baseline from production dump"
```

### ⛔ MANUAL — Phase C (Vercel + local)

- Vercel → Settings → Environment Variables: set **Preview** scope Supabase vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL`) to the **staging** project. Leave **Production** scope on prod.
- Update your local `.env.local` Supabase vars to point at **staging** (copy from `STAGING_*` in `.env.projects.local`, or `bash scripts/sync-env-from-projects.sh staging`).
- Keep Stripe mode-separated as before (test in Preview, live in Production).

### Phase D — Build the staging cast (Cursor)

```
Phase 0 — READ ONLY.
1. Read the existing seed: git ls-files | grep -iE 'seed' ; read seed:e2e script + any
   fixtures. Read cleanup-test-accounts.ts to see current account names/roles.
2. Report the full list of accounts seed:e2e currently creates and their roles.
STOP. Confirm the target staging cast with me:
   - consumer (full household + estate data)
   - superuser
   - advisor
   - a consumer linked to that advisor (the linkage case)
   - attorney
   Each seeded with a COMPLETE dataset so every assertion has data.

--- After I confirm: ---
3. Extend/rewrite the seed so it builds the full cast above with complete data, using
   supabase.auth.admin.createUser({ email, password, email_confirm: true }) so each is
   immediately authenticatable. Use lowercase canonical emails.
4. Ensure all child rows (household, plan, MC cache) reference each new user's ID.
5. Run seed:e2e against STAGING ($STAGING_DB_URL / staging service-role). Verify each
   account exists and can be queried. Report counts per role.
6. Commit: git commit -m "test(seed): full staging cast for all roles with complete data"
```

### Phase E — Build the production canary (Cursor writes; you run)

```
Phase 0 — READ ONLY.
1. Identify the exact dataset shape a consumer household needs for the prod canary-smoke
   E2E to pass (which tables/rows the smoke asserts on). Report them.
STOP. Confirm canary email + that it gets FRESH synthetic data (no clone of any real row).

--- After I confirm: ---
2. Write scripts/seed-prod-canary.ts that:
   - admin-creates the canary (email_confirm:true, password from env E2E_CANARY_PASSWORD)
   - seeds a COMPLETE consumer household onto the canary's NEW user ID (not a copied ID)
   - is idempotent (safe to re-run to reset the canary to known state)
   - refuses to run unless TARGET is explicitly prod AND a --confirm flag is passed
     (so it can't seed the wrong DB by accident)
3. Do NOT run it. Print the exact command for me to run against prod myself.
4. Commit: git commit -m "test(canary): prod consumer canary seed/reset script"
```

⛔ **MANUAL after E:** set `E2E_CANARY_PASSWORD` in Vercel **Production** scope, then run
`scripts/seed-prod-canary.ts --confirm` against prod yourself. Verify the canary can log in.

### Phase F — Production cleanup (Cursor prepares + dry-runs; YOU execute)

```
Phase 0 — READ ONLY.
1. Read cleanup-test-accounts.ts. Report its current PROTECTED list and prod guard.
STOP. Confirm the THREE-row keep-list with me:
   david@gmail.com, avoels@comcast.net, canary-consumer@mywealthmaps.com.

--- After I confirm: ---
2. Update PROTECTED to exactly those three (lowercase). Keep the prod-URL/--force guard.
3. Add/confirm a DRY-RUN mode that SELECTs and prints every row it WOULD delete
   (id, email, role, created_at) without deleting. Default must be dry-run.
4. Run DRY-RUN against PROD. Print the full list of rows that would be deleted.
   Confirm the three keepers are NOT in that list. Report.
5. Do NOT execute the delete. Print the exact --execute command for me.
6. Commit: git commit -m "chore(cleanup): prod keep-list = 3 protected rows, dry-run default"
```

⛔ **MANUAL after F dry-run:**

1. Back up prod first (free tier has no auto-backups):
   `pg_dump "$PROD_DB_URL" > prod_backup_$(date +%F).sql` — verify the file is non-trivial.
2. Re-read the dry-run list; confirm your three keepers are absent from it.
3. Only then run the `--execute` command yourself. After this, prod is never purged again.

### Phase G — E2E split + staging keep-alive (Cursor)

```
Phase 0 — READ ONLY. List current e2e specs + their target URLs. Report which are
consumer-only vs privileged-role.

--- Then implement: ---
1. STAGING = full suite (all roles, including advisor/superuser/attorney, MFA off).
   Wire it to run against the staging Preview URL / local staging DB.
2. PROD = canary-smoke subset only: consumer signup-adjacent + checkout + estate path,
   logging in as the canary with E2E_CANARY_PASSWORD. NO privileged-role specs against prod.
3. Add .github/workflows/staging-keepalive.yml: scheduled (e.g. every 3 days) curl/ping to
   the staging project URL so it never hits the 7-day pause. Secret-free (URL ping only) —
   honors the no-GitHub-secrets rule.
4. Commit: git commit -m "test(e2e): staging full suite + prod canary smoke; staging keep-alive"
```

### Phase H — Lock the rules + update docs (Cursor)

```
1. Confirm cleanup:purge / cleanup-test-accounts.ts can only target staging now
   (prod path requires --force AND lists only the 3-row keep-list). Report.
2. Update DEPLOYMENT.md: replace the §7 stub with the achieved steady state
   (two DBs, three-row prod keep-list, staging-full/prod-canary-smoke split, purge=staging-only).
3. Update ENVIRONMENT_TESTING.md to reference the new model (point to DEPLOYMENT.md, don't duplicate).
4. Archive this migration file: git mv TWO_DB_MIGRATION.md docs/archive/ with an
   "EXECUTED <date>" header.
5. Commit: git commit -m "docs: adopt two-DB steady state, archive migration runbook"
Do NOT touch MASTER_ARCHITECTURE, CALCULATION_ENGINES, DECISION_LOG, ROADMAP.
```

---

## PART 3 — After migration (steady state)

- New flow: local + Preview → **staging DB**; Production → **prod DB**. Code promotes; data never does.
- Testing: full E2E on staging; canary smoke on prod; wipe staging freely with `purge → seed:e2e`.
- Prod residents: 1 real client + superuser + 1 canary. Nothing else synthetic.
- Maintenance: re-run `seed-prod-canary --confirm` if the canary ever drifts; daily
  `post-deploy-verify` cron keeps its MC cache fresh; staging keep-alive prevents the pause.
- This unblocks the *other* upgrade too: with disposable staging creds, you may now put
  staging-only secrets in GitHub Actions and move E2E/RLS onto PRs (see DEPLOYMENT.md §5).
