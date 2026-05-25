# My Wealth Maps — Cursor Prompt Template
# Drop this into any Cursor session to get on-brand components immediately.
# Updated: 2026-06 (replaces PlanWise Guide naming in DESIGN_SYSTEM.md)

---

## Standard component prompt

Build a [COMPONENT NAME] following the My Wealth Maps design system.

Rules — typography:
- Section/page titles: font-family var(--font-display) [Playfair Display], color var(--mwm-navy)
- All UI text, buttons, labels, body copy: font-family var(--font-body) [DM Sans]
- Never mix display and body font on the same text element

Rules — color (NO hardcoded hex, NO indigo, NO neutral-* for brand surfaces):
- Primary CTA buttons: bg var(--mwm-navy), text white, hover var(--mwm-navy-light)
- High-emphasis CTA (hero): bg var(--mwm-gold), text var(--mwm-navy)
- Outline buttons: border + text var(--mwm-navy), hover fills navy
- Success / advisor actions: var(--mwm-sage)
- Destructive: var(--mwm-danger) #c53030
- Page background: var(--mwm-off-white) #fafaf8
- Card background: white
- Body text: var(--mwm-text-secondary) #4a5568
- Muted/meta text: var(--mwm-text-muted) #718096
- Headings: var(--mwm-navy) or var(--mwm-text-primary)

Rules — cards:
- bg white, border 1px solid var(--mwm-border), border-radius var(--mwm-radius) [12px]
- box-shadow var(--mwm-shadow)
- On hover (if interactive): border-color var(--mwm-gold), shadow var(--mwm-shadow-lg), translateY(-2px)

Rules — form inputs:
- Import formControlClass, formLabelClass, formErrorClass from @/lib/ui/form
- Focus ring: var(--mwm-navy) with /20 opacity ring — NOT indigo
- No dark mode classes on planning-app forms

Rules — layout:
- Use shared primitives: Button (from @/components/ui/Button), Card, SectionHeader
- Never use bg-indigo-*, text-indigo-*, ring-indigo-*, focus:border-indigo-*
- Never use bg-neutral-50 as a page shell — use var(--mwm-off-white)
- Sidebar active state: bg var(--mwm-navy), text white (not indigo active)

The component should: [DESCRIBE YOUR COMPONENT]

---

## Dashboard shell / chrome prompt

Update [SHELL COMPONENT] to use the My Wealth Maps design system for authenticated pages.

- Page/layout background: bg-[var(--mwm-off-white)]
- Sidebar background: bg-[var(--mwm-navy)]
- Sidebar active nav item: bg-[var(--mwm-navy-light)] with left border var(--mwm-gold)
- Sidebar inactive nav text: text-white/70, hover text-white bg-white/10
- Sidebar footer links (My Advisor, My Attorney, Manage Subscription, Sign out): same inactive style
- Top bar / breadcrumb area: bg-white, border-b border-[var(--mwm-border)]
- Tier badge colors: Financial = var(--mwm-gold-pale) text var(--mwm-navy); Retirement = var(--mwm-sage-pale) text var(--mwm-sage); Estate = var(--mwm-navy) text white
- No emerald-*, no blue-*/green-*/purple-* tier badges
- Page title (h1): font-[family-name:var(--font-display)] text-[var(--mwm-navy)]

---

## Token quick-reference (paste into any Cursor chat)

--mwm-navy:           #0f1f3d   ← primary brand, buttons, sidebar
--mwm-navy-light:     #1a3460   ← hover state
--mwm-navy-mid:       #2a4a7f   ← gradient end for dark sections
--mwm-gold:           #c9a84c   ← accent, active nav, high-emphasis CTA
--mwm-gold-light:     #e8c97a   ← gold hover
--mwm-gold-pale:      #fdf6e3   ← gold tint backgrounds
--mwm-sage:           #4a7c6f   ← success, advisor, checkboxes
--mwm-sage-light:     #6aab9a   ← sage hover
--mwm-sage-pale:      #eef6f4   ← sage tint backgrounds
--mwm-off-white:      #fafaf8   ← page/layout background (NOT white, NOT neutral-50)
--mwm-text-primary:   #1a202c
--mwm-text-secondary: #4a5568   ← body copy
--mwm-text-muted:     #718096   ← meta, captions
--mwm-border:         #e2e8f0
--mwm-border-dark:    #cbd5e0
--mwm-danger:         #c53030
--mwm-shadow:         0 4px 20px rgba(15,31,61,0.08)
--mwm-shadow-lg:      0 8px 40px rgba(15,31,61,0.14)
--mwm-radius:         12px
--mwm-radius-sm:      8px
--mwm-radius-lg:      20px

Short aliases (same values, both work):
--navy = var(--mwm-navy)
--gold = var(--mwm-gold)
--sage = var(--mwm-sage)
--off-white = var(--mwm-off-white)
--shadow = var(--mwm-shadow)
--shadow-lg = var(--mwm-shadow-lg)

---

## What to find-and-replace across the codebase (Phase 3 sweep)

Tailwind class replacements:
  bg-indigo-600        → bg-[var(--mwm-navy)]
  bg-indigo-700        → bg-[var(--mwm-navy-light)]
  text-indigo-600      → text-[var(--mwm-navy)]
  text-indigo-700      → text-[var(--mwm-navy)]
  border-indigo-500    → border-[var(--mwm-navy)]
  focus:border-indigo-500 → focus:border-[var(--mwm-navy)]
  ring-indigo-500      → ring-[var(--mwm-navy)]
  bg-emerald-*         → bg-[var(--mwm-sage)] or bg-[var(--mwm-sage-pale)]
  text-emerald-*       → text-[var(--mwm-sage)]
  bg-neutral-50        → bg-[var(--mwm-off-white)]   (page shells only)
  text-neutral-900     → text-[var(--mwm-text-primary)]
  text-neutral-600     → text-[var(--mwm-text-secondary)]

Hardcoded hex to replace:
  #1B2A4A  → var(--mwm-navy)
  #2E4270  → var(--mwm-navy-light)
  #1a3460  → var(--mwm-navy-light)
  #c9a84c  → var(--mwm-gold)

Note: neutral-* used for TABLE rows, dividers, and subtle borders inside cards is fine —
only replace when it's being used as a primary surface or brand color.
