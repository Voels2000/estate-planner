# Go-live E2E pre-flight

Run these against **production** (`PLAYWRIGHT_BASE_URL` in `.env.test`, default `https://www.mywealthmaps.com`) **after every deploy** that touches profile, inline prompts, or planning surfaces — and as the final automated gate before `PUBLIC_SIGNUP_OPEN=true`.

**Prerequisites:** `npm run seed:e2e` on the target environment; copy printed block to `.env.test` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)). Requires `PLAYWRIGHT_HOUSEHOLD_ID` + `SUPABASE_SERVICE_ROLE_KEY`.

**GitHub Actions (pre-go-live):** Enable E2E smoke on every `main` push/PR before open signups — [LAUNCH_CHECKLIST § GitHub Actions E2E smoke](./LAUNCH_CHECKLIST.md#github-actions-e2e-smoke-pre-go-live). Workflow runs against localhost + production Supabase; local pre-flight below uses production URL.

**Post-deploy cron:** `/api/cron/post-deploy-verify` (daily 9:00 UTC, `CRON_SECRET`) **backfills missing Voels MC cache**, then runs the 7 checks. Manual: `npm run verify:post-deploy-voels` (no auto-remediate) or `npm run smoke:mc-voels` for immediate backfill.

---

## One command — profile + inline prompts (recommended)

```bash
npm run test:e2e:go-live-profile
```

**17 tests** across three specs (`--workers=1`; includes consumer auth setup):

| Spec | What it proves |
|------|----------------|
| `consumer-profile-save.spec.ts` | Full PATCH, UI name save, **3 partial PATCH shapes** (SS, retirement/longevity, custom deduction) |
| `consumer-profile-spouse-layout.spec.ts` | Slim profile layout; **deferred fields absent** on `/profile` |
| `consumer-profile-field-prompt.spec.ts` | **ProfileFieldPrompt UI** on `/scenarios` + `/social-security`: save, dismiss, deduction conditional, PIA accuracy |

---

## Partial PATCH only (API merge smoke)

Run **each grep independently** — do not combine into one run when validating post-deploy merge:

```bash
npm run test:e2e:partial-patch
```

Or individually:

```bash
npx dotenv -e .env.test -- npx playwright test tests/e2e/consumer/consumer-profile-save.spec.ts \
  --project=consumer --grep "partial PATCH with SS fields only" --workers=1

npx dotenv -e .env.test -- npx playwright test tests/e2e/consumer/consumer-profile-save.spec.ts \
  --project=consumer --grep "partial PATCH with retirement/longevity only" --workers=1

npx dotenv -e .env.test -- npx playwright test tests/e2e/consumer/consumer-profile-save.spec.ts \
  --project=consumer --grep "partial PATCH with custom deduction only" --workers=1
```

---

## Post-deploy automated verification

After profile pre-flight, import unit tests should pass:

```bash
npm run test:import:unit   # 24 tests — projection readiness, wizard gate, import normalizer
```

**Prospect + Mobile sprint (2026-05-29):** Playwright: `advisor-prospect-mode.spec.ts`, `consumer-mobile-review.spec.ts` (Track 2 — `npm run test:e2e:mobile`). **Accessibility (L1):** `npm run test:e2e:a11y`. Manual 19-step checklist: [LAUNCH_CHECKLIST § Prospect + Mobile manual smoke](./LAUNCH_CHECKLIST.md#prospect--mobile-review-mode-manual-smoke-2026-05-29).

**Health Score + Playbook + Security sprint (2026-05-29):** Playwright: `consumer-health-score-narrative.spec.ts`, `advisor-first-client-playbook.spec.ts`. CI: `.github/workflows/ci.yml` (lint, build, security audit, unit tests). Manual: [LAUNCH_CHECKLIST § Health Score + Playbook](./LAUNCH_CHECKLIST.md#health-score--advisor-first-client-playbook-manual-smoke-2026-05-29).

---

## Security hardening post-deploy smoke (2026-05-29)

Run on **production** (`https://www.mywealthmaps.com`) after `db push` + `estate-monte-carlo` deploy + API route fix (`af12ff0`).

**Status:** ✅ Passed 7/7 on prod 2026-05-30 — `npm run test:e2e:security-smoke`

### Automated

```bash
npm run test:e2e:security-smoke
# or individually:
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/public/security-sprint-post-deploy.spec.ts --project=public --workers=1
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/consumer/security-sprint-rpc-pages.spec.ts --project=consumer --workers=1
npx dotenv -o -e .env.test -- npx playwright test tests/e2e/advisor/security-sprint-monte-carlo.spec.ts --project=advisor --workers=1
```

| Spec | Proves |
|------|--------|
| `security-sprint-post-deploy.spec.ts` | Referral 429 after ~60 POSTs; telemetry 401 without session |
| `security-sprint-rpc-pages.spec.ts` | Consumer `/estate-tax` + gifting tab load (RPC guards) |
| `security-sprint-monte-carlo.spec.ts` | Advisor Monte Carlo edge returns P10/P50/P90 (JWT auth) |

### Manual — DevTools Console (no login required for API checks)

**Referral rate limit** — open `/event/selling-a-business`, paste:

```javascript
const results = []
for (let i = 0; i < 65; i++) {
  const r = await fetch('/api/referral/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'test123' })
  })
  results.push(r.status)
}
console.log(results.reduce((acc, s) => {
  acc[s] = (acc[s] || 0) + 1; return acc
}, {}))
```

Expected: `{ 200: ~60, 429: ~5 }` — unresolved refs return **200** (`ok: true, resolved: false`); **429** confirms rate limiting.

**Telemetry auth** — logged out or incognito:

```javascript
fetch('/api/telemetry/horizon-input-missing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ test: true })
}).then(r => console.log('Status:', r.status))
```

Expected: **401**

**Monte Carlo:** `e2e-advisor@mywealthmaps.test` → Johnson → Strategy → Run Monte Carlo — P10/P50/P90 in UI; Network: no 401/403 on edge function.

**Consumer RPCs:** `e2e-consumer@mywealthmaps.test` → `/estate-tax`, `/my-estate-trust-strategy?tab=gifting` — data visible, no 403.

Checklist: [LAUNCH_CHECKLIST § Security hardening post-deploy browser smoke](./LAUNCH_CHECKLIST.md#security-hardening-post-deploy-browser-smoke-2026-05-29).

---

## Broader go-live automated suite

After profile pre-flight passes, run the full consumer project (or complete suite):

```bash
npm run test:e2e:consumer -- --workers=1
# or
npm run test:e2e:complete -- --workers=1
```

See [E2E_RELEASE_TEST_PLAN.md](./E2E_RELEASE_TEST_PLAN.md) for mapping to manual [CONSUMER_RELEASE_SMOKE_TEST.md](./CONSUMER_RELEASE_SMOKE_TEST.md).

---

## Manual-only (not fully automatable)

- Dollar math on projections / estate tax (human spot-check)
- Stripe live-card checkout (Phase 2)
- Fresh signup → Supabase attribution (`?ref=` / `?aref=`)
- Email drip inbox delivery
- Counsel sign-off on ToS ([LEGAL_TODO.md](./LEGAL_TODO.md))
- **Prospect Mode + Mobile Review (2026-05-29)** — 19-step checklist: [LAUNCH_CHECKLIST § Prospect + Mobile manual smoke](./LAUNCH_CHECKLIST.md#prospect--mobile-review-mode-manual-smoke-2026-05-29)

---

## Checklist integration

- [LAUNCH_CHECKLIST.md § Pre-launch E2E](./LAUNCH_CHECKLIST.md) — checkbox targets this doc
- Inline prompt manual rows: [CONSUMER_RELEASE_SMOKE_TEST.md §3.4](./CONSUMER_RELEASE_SMOKE_TEST.md)
