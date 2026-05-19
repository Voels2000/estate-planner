# NEXT_SESSION.md
# Sprint 2 — Session Start Document
# Generated: May 2026 (after Sprint 1 completion)

---

## Paste this as your FIRST MESSAGE in Cursor

> I am building My Wealth Maps, a self-guided estate and financial
> planning tool for households with $2M–$30M in assets. The engine
> is strong — we are doing UI and structural work only. Sprint 1
> is complete (sidebar nav separation, public route group, upgrade
> gate personalization, projections name labels). Sprint 2 goal:
> life event landing pages and marketing-site carryover. Today's
> task: [FILL IN FROM TASK LIST BELOW].

---

## Sprint 1 — What shipped

| Task | Status | Notes |
|------|--------|-------|
| Sidebar: public links removed from Overview | ✅ Done | Profile + Estate Summary only |
| Sidebar: My Attorney → footer (tier 2+) | ✅ Done | Attorney access settings removed from nav |
| Sidebar: "Your plan" badge on active group | ✅ Done | Financial / Retirement / Estate colors |
| UpgradeBanner `householdContext` on locked pages | ✅ Done | All tier 2/3 gates; SS + domicile added |
| Public route group `app/(public)/` | ✅ Done | education, assess, find-advisor, find-attorney |
| Projections: full first names in headers | ✅ Done | `_projections-client.tsx` |
| Public marketing top nav on `(public)` layout | 🔄 Sprint 2 | Passthrough layout only; pages keep own nav |
| Homepage / pricing segment copy | 🔄 Sprint 2 | See ROADMAP Sprint 2 carryover |

---

## Sprint 2 — Priority order

### A. Public marketing chrome (Sprint 1 carryover)

**Files:**
```
app/(public)/layout.tsx
app/page.tsx
app/pricing/page.tsx
```

Add shared top nav to `(public)/layout.tsx` per ROADMAP Sprint 1 spec (Education · Assessment · Find Advisor · Find Attorney · Pricing · Log in · Get started). Education pages keep their existing auth-gated header inside `app/(public)/education/layout.tsx`.

### B. Life event pages (Sprint 2 core)

See [ROADMAP.md](./ROADMAP.md) Sprint 2 for the 8 priority `/event/[slug]` pages and infrastructure tasks.

---

## Key file paths (post–Sprint 1)

| Area | Path |
|------|------|
| Dashboard layout + sidebar | `app/(dashboard)/layout.tsx`, `app/(dashboard)/_components/sidebar-nav.tsx` |
| Upgrade gates | `app/(dashboard)/_components/UpgradeBanner.tsx`, each `page.tsx` under planning routes |
| Public routes | `app/(public)/layout.tsx`, `app/(public)/education/`, `assess/`, `find-advisor/`, `find-attorney/` |
| Auth proxy | `proxy.ts` (root) |
| Projections names | `app/(dashboard)/projections/_projections-client.tsx` |
| Name helper | `lib/display-person-name.ts` |

---

## Sprint 2 success criteria (initial)

- [ ] Shared public top nav on `(public)` layout
- [ ] First life event page live at `/event/[slug]` with MDX + assessment hook
- [ ] No regression: public URLs (`/education`, `/assess`, `/find-advisor`, `/find-attorney`) load without dashboard sidebar
- [ ] App sidebar still planning-only (Overview = Profile + Estate Summary)

---

## How to end each session

Ask: "Summarize what we completed today and update NEXT_SESSION.md with remaining Sprint 2 tasks and any new file paths discovered."

Commit the updated `NEXT_SESSION.md` alongside code changes.
