# Release routine — local → preview → production

**Canonical checklist** for shipping changes safely. Follow this on every meaningful release once go-live discipline is enabled.

**Related:** [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) (envs & credentials) · [GO_LIVE_E2E.md](./GO_LIVE_E2E.md) · [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md)

---

## Two modes

| Mode | When | What you must run |
|------|------|-------------------|
| **Development** (now) | Before `PUBLIC_SIGNUP_OPEN` | `npm run release:local` before PRs; CI on every push/PR |
| **Go-live discipline** (enable once) | Pre-flip + every release after | Full three-gate flow below + GitHub required checks |

Do **not** enable strict gates until Section 1 of [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) is nearly complete — but **do** run `release:local` today so CI failures are rare.

---

## Three gates (the routine)

Every production release follows the same order. Do not skip a gate or reorder.

```text
  LOCAL          PREVIEW              CI (GitHub)         PRODUCTION
  ─────          ───────              ───────────         ──────────
  release:       Vercel branch        merge only when     release:
  preflight      deploy + manual      checks green        post-deploy
       │         smoke                     │                  │
       └─────────┴─────────────────────────┴──────────────────┘
                         git push branch → PR → main → Vercel prod deploy
```

### Gate 1 — Local (before you push)

**Minimum (always):**

```bash
npm run release:local
```

Runs: lint, build, `verify:consumer-openapi`, unit tests — same surface as `ci.yml`.

**Full preflight (required once go-live discipline is on):**

```bash
npm run release:preflight
```

Adds: `verify:rls` (JWT), `test:e2e:go-live-profile`, `test:e2e:security-smoke` against **localhost + your Supabase** (`.env.local` + `.env.test`).

**When:** Before every PR that touches app logic, auth, billing, RLS, or API routes.

---

### Gate 2 — Preview (before you merge)

Vercel builds every branch/PR automatically.

| Check | How |
|-------|-----|
| Build succeeded | Vercel dashboard or PR comment |
| Auth callback | Sign in on preview URL (`estate-planner-gules.vercel.app` or PR-specific `*.vercel.app`) |
| Billing (if touched) | Stripe **test** mode walkthrough on preview |
| Visual spot-check | Key page you changed loads without error |

**Do not** run heavy Playwright against preview URLs for API-heavy specs — preview can hang on `POST /api/*`. Use localhost + Supabase for E2E (Gate 1).

**When:** After Gate 1 passes, before merging the PR.

---

### Gate 3 — CI (automatic block on merge)

On every push/PR to `main`:

| Workflow | Always? | Job name |
|----------|---------|----------|
| [CI](../.github/workflows/ci.yml) | **Yes** | `verify` |
| [E2E smoke](../.github/workflows/e2e-smoke.yml) | When `E2E_SMOKE_IN_CI=true` | `e2e-smoke` |
| [RLS verify](../.github/workflows/rls-verify.yml) | When `RLS_VERIFY_IN_CI=true` | `rls-verify` |

**Rule:** Do not merge until required checks are green.

---

### Gate 4 — Production (after Vercel deploys `main`)

```bash
npm run release:post-deploy
```

Runs: `verify:post-deploy-voels` + `verify:rls --require-sql` (needs `SUPABASE_DB_URL` in `.env.local` only — never GitHub).

**Optional** prod browser smoke:

```bash
PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:security-smoke -- --workers=1
```

**When:** Within 30 minutes of every production deploy that changes auth, RLS, billing, or estate math.

---

## Turn on go-live discipline (one-time)

Complete **before** flipping `PUBLIC_SIGNUP_OPEN=true`. Check each box once; keep settings for all future releases.

### 1. GitHub repository variables

Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|----------|-------|
| `E2E_SMOKE_IN_CI` | `true` |
| `RLS_VERIFY_IN_CI` | `true` |

### 2. GitHub secrets (Supabase used for CI)

Same project your preview app uses today unless you split staging later — see [ENVIRONMENT_TESTING.md § Current setup](./ENVIRONMENT_TESTING.md#current-setup-today).

| Secret | Source |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role |
| `PLAYWRIGHT_HOUSEHOLD_ID` | Output of `npm run seed:e2e` |
| `PLAYWRIGHT_*` emails/passwords | Optional — defaults from seed |

**Never add:** production-only keys you do not want in CI, `SUPABASE_DB_URL`.

Verify with **Actions → E2E smoke → Run workflow** (manual dispatch) until green.

### 3. Branch protection on `main`

Settings → Branches → Add rule for `main`:

- [ ] Require a pull request before merging
- [ ] Require status checks to pass:
  - `verify` (CI)
  - `e2e-smoke` (after step 1)
  - `rls-verify` (after step 1)
- [ ] Do not allow bypassing (even for admins — keeps you honest as solo founder)

### 4. Vercel (likely already correct)

- **Production** branch = `main` only
- **Preview** = all other branches / PRs
- Production env vars = live Supabase, Stripe, `PUBLIC_SIGNUP_OPEN` when ready
- Preview env vars = test Stripe, same Supabase as CI (today)

### 5. Local habit

Before every merge to `main`:

```bash
npm run release:preflight
```

After every prod deploy:

```bash
npm run release:post-deploy
```

---

## Quick reference

| Command | Gate |
|---------|------|
| `npm run release:local` | Local minimum |
| `npm run release:preflight` | Local full |
| Preview URL manual smoke | Preview |
| Green CI on PR | CI |
| `npm run release:post-deploy` | Production |

---

## Why this enforces discipline

| Layer | Enforcement |
|-------|-------------|
| **Scripts exit non-zero** | Cannot “forget” a step without seeing failure |
| **CI required checks** | GitHub blocks merge if tests fail |
| **E2E/RLS off until go-live** | No CI cost/noise while still building; flip once before open signups |
| **Post-deploy local-only** | Prod SQL RLS never in GitHub; still mandatory via script + checklist |
| **Single doc** | This file is the contract — no guessing order |

---

## Decision log (2026-06-07)

**Chosen:** Documented three-gate routine + npm script bundles + GitHub branch protection toggled at go-live prep — not a custom release bot or third-party tool.

See [DECISION_LOG.md](./DECISION_LOG.md) for product decisions; [ENVIRONMENT_TESTING.md](./ENVIRONMENT_TESTING.md) for credential placement.
