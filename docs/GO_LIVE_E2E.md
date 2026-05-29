# Go-live E2E pre-flight

Run these against **production** (`PLAYWRIGHT_BASE_URL` in `.env.test`, default `estate-planner-gules.vercel.app`) **after every deploy** that touches profile, inline prompts, or planning surfaces — and as the final automated gate before `PUBLIC_SIGNUP_OPEN=true`.

**Prerequisites:** `npm run seed:e2e` on the target environment; copy printed block to `.env.test` ([E2E_TEST_RESET.md](./E2E_TEST_RESET.md)). Requires `PLAYWRIGHT_HOUSEHOLD_ID` + `SUPABASE_SERVICE_ROLE_KEY`.

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

---

## Checklist integration

- [LAUNCH_CHECKLIST.md § Pre-launch E2E](./LAUNCH_CHECKLIST.md) — checkbox targets this doc
- Inline prompt manual rows: [CONSUMER_RELEASE_SMOKE_TEST.md §3.4](./CONSUMER_RELEASE_SMOKE_TEST.md)
