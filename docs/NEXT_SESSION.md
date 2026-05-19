# NEXT_SESSION.md
# Sprint 2 — Session Start Document
# Generated: May 2026 (Sprint 2 Track A + B shipped)

---

## Paste this as your FIRST MESSAGE in Cursor

> I am building My Wealth Maps, a self-guided estate and financial
> planning tool for households with $2M–$30M in assets. The engine
> is strong — we are doing UI and structural work only. Sprint 2
> Track A + B are shipped: public top nav on `(public)` routes,
> homepage/pricing segment copy, and 8 life event pages at
> `/event/[slug]`. Remaining Sprint 2: event-specific assessment
> on `/assess`, schema.org SEO, email capture, social proof.
> Today's task: [FILL IN FROM TASK LIST BELOW].

---

## Sprint 2 — What shipped (Track A + B)

| Task | Status | Notes |
|------|--------|-------|
| Shared public top nav on `(public)` layout | ✅ Done | `app/(public)/_components/public-nav.tsx` |
| Homepage hero — $2M–$30M segment | ✅ Done | `app/page.tsx` (root; keeps own nav) |
| Life events entry on homepage quick-start | ✅ Done | Links to `/event/selling-a-business` |
| Pricing vs professional fees | ✅ Done | `app/pricing/page.tsx` (inline nav) |
| `lib/events/types.ts` | ✅ Done | Typed content schema |
| `lib/events/content.ts` | ✅ Done | All 8 events, actions, 5 questions each |
| `/event/[slug]` dynamic route | ✅ Done | SSG, SEO metadata, action plan, CTAs |
| `proxy.ts` `/event` public path | ✅ Done | Unauthenticated access |

---

## Sprint 2 — Remaining

| Task | Status | Notes |
|------|--------|-------|
| Event-specific interactive assessment on `/assess` | 🔄 Pending | Event pages teaser → generic `/assess` today |
| schema.org structured data on event pages | 🔄 Pending | `generateMetadata` has title/description/OG only |
| Email capture on assessment / event results | 🔄 Pending | |
| Social proof section on marketing site | 🔄 Pending | |
| Education double-header cleanup | 🔄 Optional | `(public)` nav + education layout header |
| Move `/pricing` under `(public)` for shared nav | 🔄 Optional | Pricing keeps inline nav today |
| MDX for event content | 🔄 Deferred | TypeScript content in `lib/events/content.ts` (not MDX) |
| Assessment conversion funnel (score visible w/o login) | 🔄 Pending | Product strategy item |
| Sprint 1 carryover: in-app copy audit, Transfer Strategy tooltips, Invite advisor onboarding | 🔄 Pending | See ROADMAP |

---

## Key file paths (post–Sprint 2 Track A + B)

| Area | Path |
|------|------|
| Public layout + nav | `app/(public)/layout.tsx`, `app/(public)/_components/public-nav.tsx` |
| Life event pages | `app/(public)/event/[slug]/page.tsx` |
| Event content | `lib/events/types.ts`, `lib/events/content.ts` |
| Marketing landing | `app/page.tsx` (not in `(public)` group) |
| Pricing | `app/pricing/page.tsx` |
| Public routes | `app/(public)/education/`, `assess/`, `find-advisor/`, `find-attorney/` |
| Auth proxy | `proxy.ts` — includes `/event` |
| Dashboard + sidebar | `app/(dashboard)/layout.tsx`, `_components/sidebar-nav.tsx` |

---

## Event slugs (all live)

`selling-a-business` · `death-of-spouse` · `serious-diagnosis` · `receiving-inheritance` · `divorce` · `approaching-retirement` · `large-rsu-vest` · `new-child-grandchild`

---

## Sprint 2 success criteria (updated)

- [x] Shared public top nav on `(public)` layout
- [x] All 8 life event pages at `/event/[slug]` with SEO metadata
- [x] Homepage segment copy + life events entry point
- [x] Pricing positioned against professional fees
- [x] No regression: public URLs load without dashboard sidebar
- [ ] Event-specific assessment path (not just teaser → `/assess`)
- [ ] schema.org on event pages
- [ ] Event pages indexed in Search Console (post-deploy)

---

## How to end each session

Ask: "Summarize what we completed today and update NEXT_SESSION.md with remaining Sprint 2 tasks and any new file paths discovered."

Commit the updated `NEXT_SESSION.md` alongside code changes.
