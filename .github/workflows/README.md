# GitHub Actions (solo policy)

**Active workflow:** `ci.yml` only → job **`verify`** (lint, build with compile-only placeholders, audits, unit tests).

**No repository secrets.** E2E, RLS, and cron workflows were removed — they required Supabase or ops credentials in GitHub.

| Local substitute | When |
|------------------|------|
| `npm run release:local` | Before every PR |
| `npm run release:preflight -- --workers=1` | Before merge (auth, API, billing, migrations, estate math) |
| `npm run release:post-deploy` | After production deploy |

**Branch protection:** require PR + status check **`verify`** on `main`.

**Future:** After a dedicated staging Supabase exists, restore workflows from [docs/templates/github-workflows/](../../docs/templates/github-workflows/README.md).

Full policy: [docs/ENVIRONMENT_TESTING.md](../../docs/ENVIRONMENT_TESTING.md).
