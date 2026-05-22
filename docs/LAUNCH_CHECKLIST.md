# Launch Checklist
# My Wealth Maps — production go-live (SEO, domain, email)
# Last updated: May 2026

---

## Purpose

Single source of truth for **go-live tasks** that are intentionally deferred while the app runs on the Vercel preview URL. Check items here (not only in sprint notes) and update this file when launch work completes.

**Related docs:** [NEXT_SESSION.md](./NEXT_SESSION.md) (current sprint), [ROADMAP.md](./ROADMAP.md) (Sprint 8 launch items), [DECISION_LOG.md](./DECISION_LOG.md) (pre-launch crawl block decision).

---

## Current pre-launch state

| Area | Status |
|------|--------|
| Crawlers | `app/robots.ts` — `disallow: /` for all user agents |
| Sitemap discovery | Sitemap URL **commented out** in `robots.ts` (file `app/sitemap.ts` still generates `/sitemap.xml`) |
| Search Console | Not set up; verification env optional until launch |
| Public URL | `NEXT_PUBLIC_APP_URL` may still point at `https://estate-planner-gules.vercel.app` |
| Email drip `from` | `My Wealth Maps <hello@mywealthmaps.com>` in `app/api/email/drip/route.ts` — domain must be verified in Resend |

`proxy.ts` already allows unauthenticated access to `/education`, `/sitemap.xml`, `/robots.txt`, and other public marketing paths.

---

## Launch checklist

### SEO & indexing

- [ ] **Restore `app/robots.ts`** — allow public routes; disallow app/dashboard/advisor/admin/api paths (permissive version shipped in commit `fb6aa9b`; blocked in `b3198f3`)
- [ ] **Uncomment sitemap** in `robots.ts` — `sitemap: \`${BASE_URL}/sitemap.xml\`` and restore `BASE_URL` constant
- [ ] **Deploy** and confirm `https://<production-domain>/robots.txt` allows crawling of public paths
- [ ] **Search Console** — add URL-prefix property for production domain
- [ ] **Verification** — set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` in Vercel Production (content value from HTML tag method); redeploy; confirm meta tag in page source (`app/layout.tsx`)
- [ ] **Verify** ownership in Search Console
- [ ] **Submit sitemap** — Sitemaps → add `sitemap.xml` → Submit
- [ ] **Spot-check indexing** — sample event URLs from `lib/events/content.ts` (`EVENT_SLUGS`)

### Domain & environment (Vercel Production)

- [ ] **`NEXT_PUBLIC_APP_URL`** → `https://mywealthmaps.com` (or final canonical origin)
- [ ] **Redeploy** after env change so sitemap, drip links, and emails use production URL
- [ ] **DNS / Vercel** — custom domain attached and SSL active

### Email (Resend)

- [ ] **Verify domain** `mywealthmaps.com` in Resend (SPF/DKIM)
- [ ] **Confirm `from` address** — `hello@mywealthmaps.com` in `app/api/email/drip/route.ts` (and other Resend sends if applicable)
- [ ] **Smoke test** — trigger drip step 1 via event assess email capture on production

### Ops already required (confirm at launch)

- [ ] `RESEND_API_KEY` set in Production
- [ ] `INTERNAL_API_KEY` matches between Vercel and drip/cron callers
- [ ] `CRON_SECRET` set for `/api/cron/notifications`
- [ ] Migration `20260524000000_email_captures_drip.sql` applied in Supabase prod

---

## Key files

| File | Launch action |
|------|----------------|
| `app/robots.ts` | Restore allow/disallow rules; enable sitemap line |
| `app/sitemap.ts` | No change — uses `NEXT_PUBLIC_APP_URL` |
| `app/layout.tsx` | `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` |
| `proxy.ts` | No change unless new public routes added |
| `app/api/email/drip/route.ts` | Confirm `from` domain |
| `.env.local` / Vercel | `NEXT_PUBLIC_APP_URL`, verification, Resend keys |

---

## After launch

When all items above are checked:

1. Update checkboxes in this file (or note completion date in a short changelog section below).
2. Update [ROADMAP.md](./ROADMAP.md) — mark Sprint 8 launch items complete.
3. Update [NEXT_SESSION.md](./NEXT_SESSION.md) — remove or shorten pre-launch warning; point to completed state here.
4. Optional [DECISION_LOG.md](./DECISION_LOG.md) entry if launch policy changes (e.g. staging crawl rules).

### Completion log

| Date | Notes |
|------|-------|
| — | _Record launch date and who verified Search Console / domain._ |
