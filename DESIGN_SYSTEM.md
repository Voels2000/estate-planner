# PlanWise Guide — Design System Specification
## For Use with Cursor AI to Match the Reference UI

This document is the single source of truth for all visual and UI decisions
in the PlanWise Guide platform. Every component, color, spacing rule, and
typography choice must follow this specification exactly.

---

## 1. TYPOGRAPHY

### Fonts
- **Display / Headings:** `'Playfair Display', Georgia, serif`
  - Used for: page titles, section titles, lesson titles, card headings, modal headers
  - Weights used: 400 (regular), 500 (medium), 600 (semibold)
- **Body / UI:** `'DM Sans', system-ui, sans-serif`
  - Used for: all body text, navigation, buttons, labels, paragraphs, table content
  - Weights used: 300 (light), 400 (regular), 500 (medium)

### Font Import (add to every HTML file `<head>`)
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

### Type Scale
| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Page `<h1>` hero | Playfair Display | 44px | 500 | `--navy` |
| Section title `.section-title` | Playfair Display | 26px | 500 | `--navy` |
| Card heading `<h3>` | DM Sans | 15px | 500 | `--navy` |
| Lesson title | Playfair Display | 28px | 500 | white (on dark bg) |
| Body paragraph | DM Sans | 15px | 400 | `--text-secondary` |
| Small/meta text | DM Sans | 12–13px | 400 | `--text-muted` |
| Button text | DM Sans | 14px | 500 | varies by button type |
| Badge/tag text | DM Sans | 10–11px | 500 | varies by badge type |
| Nav tab text | DM Sans | 12px | 400/500 | see nav spec |

---

## 2. COLOR SYSTEM

### CSS Custom Properties (declare in `:root`)
```css
:root {
  /* Brand Colors */
  --navy: #0f1f3d;
  --navy-light: #1a3460;
  --navy-mid: #2a4a7f;
  --gold: #c9a84c;
  --gold-light: #e8c97a;
  --gold-pale: #fdf6e3;
  --sage: #4a7c6f;
  --sage-light: #6aab9a;
  --sage-pale: #eef6f4;

  /* Neutral */
  --slate: #4a5568;
  --slate-light: #718096;
  --slate-pale: #f7f8fa;
  --white: #ffffff;
  --off-white: #fafaf8;

  /* Borders */
  --border: #e2e8f0;
  --border-dark: #cbd5e0;

  /* Semantic */
  --danger: #c53030;
  --danger-pale: #fff5f5;

  /* Text */
  --text-primary: #1a202c;
  --text-secondary: #4a5568;
  --text-muted: #718096;

  /* Radius */
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 20px;

  /* Shadows */
  --shadow: 0 4px 20px rgba(15, 31, 61, 0.08);
  --shadow-lg: 0 8px 40px rgba(15, 31, 61, 0.14);

  /* Font references */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
}
```

### Color Usage Rules
| Context | Color |
|---------|-------|
| Primary brand background | `--navy` |
| Page background | `--off-white` |
| Card background | `--white` |
| Accent / CTA highlight | `--gold` |
| Success / check icons | `--sage` |
| Danger / warnings | `--danger` |
| Body text | `--text-secondary` |
| Muted/meta text | `--text-muted` |
| Headings | `--text-primary` or `--navy` |

---

## 3. LAYOUT

### App Container
```css
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 0 80px;
}
```

### Page Padding
All page sections use `padding: 28px` on the outer `.page` wrapper.

### Grid Patterns
| Use | Grid definition |
|-----|----------------|
| Hero features (3 col) | `grid-template-columns: repeat(3, 1fr); gap: 16px` |
| Module cards (2 col) | `grid-template-columns: repeat(2, 1fr); gap: 16px` |
| Results cards (2 col) | `grid-template-columns: 1fr 1fr; gap: 16px` |
| Advisor cards (2 col) | `grid-template-columns: repeat(2, 1fr); gap: 16px` |
| Glossary (2 col) | `grid-template-columns: repeat(2, 1fr); gap: 12px` |
| Life stages (3 col) | `grid-template-columns: repeat(3, 1fr); gap: 14px` |
| Strategy pros/cons | `grid-template-columns: 1fr 1fr; gap: 20px` |

### Responsive Breakpoint
At `max-width: 700px`, all grids collapse to `grid-template-columns: 1fr`.
Life stage grid remains `repeat(2, 1fr)` at mobile.

---

## 4. NAVIGATION

### Structure
```
[Logo circle "P"] [PlanWise Guide title] [nav-subtitle]    [tab] [tab] [tab] ...
```

### Nav Styles
```css
.nav {
  background: var(--navy);
  padding: 16px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
}
.nav-logo {
  width: 36px; height: 36px;
  background: var(--gold);
  border-radius: 50%;
  font-family: var(--font-display);
  font-weight: 600; font-size: 16px;
  color: var(--navy);
  display: flex; align-items: center; justify-content: center;
}
.nav-tab {
  background: none; border: none;
  color: rgba(255,255,255,0.6);
  font-size: 12px; padding: 7px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer; transition: all .2s;
}
.nav-tab:hover { background: rgba(255,255,255,0.1); color: white; }
.nav-tab.active { background: var(--gold); color: var(--navy); font-weight: 500; }
```

---

## 5. DISCLAIMER BANNER

Always present below the nav, above page content. Never remove.

```css
.disclaimer {
  background: var(--navy-light);
  border-left: 4px solid var(--gold);
  margin: 20px 28px 0;
  padding: 14px 18px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.disclaimer p { font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.5; }
.disclaimer strong { color: var(--gold); font-weight: 500; }
```

Text: `⚠️ **Educational purposes only.** Nothing on this platform constitutes financial, legal, tax, or investment advice. Always consult a licensed professional for guidance specific to your situation before making any planning decisions.`

---

## 6. BUTTONS

### Button Base
```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 26px;
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: 14px; font-weight: 500;
  cursor: pointer; border: none;
  transition: all .2s; text-decoration: none; line-height: 1;
}
```

### Button Variants
| Class | Background | Color | Hover |
|-------|-----------|-------|-------|
| `.btn-primary` | `--navy` | white | `--navy-light` + translateY(-1px) + shadow |
| `.btn-gold` | `--gold` | `--navy` | `--gold-light` + translateY(-1px) |
| `.btn-outline` | transparent | `--navy` | border-color `--navy` + `--slate-pale` bg |
| `.btn-sage` | `--sage` | white | `--sage-light` |

### Small variant: `.btn-sm` → `padding: 8px 18px; font-size: 13px`

---

## 7. CARDS

### Standard Card (modules, results, advisor, hero features)
```css
.card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius);      /* 12px */
  padding: 22px;
  box-shadow: var(--shadow);
  transition: all .2s;
}
.card:hover {
  border-color: var(--gold);
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Module Card specifics
- Header row: module icon (28px font-size emoji) + complexity badge (top-right)
- Title: 15px / 500 / `--navy`
- Description: 13px / `--text-muted` / line-height 1.5
- Footer: time on left, gold `›` on right

### Complexity Badges
```css
.c-foundation  { background: #e6f6ed; color: #2d6a4f; }
.c-intermediate { background: #fff4de; color: #8a5f00; }
.c-advanced    { background: #fde8e8; color: #9b1c1c; }
/* Base badge styles */
.complexity-badge {
  font-size: 10px; font-weight: 500;
  padding: 3px 10px; border-radius: 40px;
  text-transform: uppercase; letter-spacing: .4px;
}
```

### Life Stage Cards
```css
.life-stage-card {
  background: var(--white);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 20px; cursor: pointer;
  transition: all .2s;
}
.life-stage-card:hover { border-color: var(--gold); transform: translateY(-2px); box-shadow: var(--shadow); }
.life-stage-card.selected { border-color: var(--navy); background: var(--navy); }
.life-stage-card.selected h3 { color: white; }
.life-stage-card.selected p { color: rgba(255,255,255,0.65); }
```

---

## 8. LESSON / CONTENT PAGES

### Lesson Header (dark gradient banner)
```css
.lesson-header {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%);
  padding: 32px; border-radius: var(--radius);
  color: white; margin-bottom: 24px;
}
```

### Lesson Content Box
```css
.lesson-content {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 36px; margin-bottom: 20px;
  box-shadow: var(--shadow);
}
.lesson-content h3 {
  font-family: var(--font-display); font-size: 20px;
  color: var(--navy); margin: 28px 0 14px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--gold-pale);
}
.lesson-content h3:first-child { margin-top: 0; }
.lesson-content p { color: var(--text-secondary); margin-bottom: 14px; line-height: 1.75; }
.lesson-content ul { padding-left: 22px; margin-bottom: 16px; color: var(--text-secondary); }
.lesson-content ul li { margin-bottom: 8px; line-height: 1.65; }
```

### Callout Boxes (three types)
```css
/* Info (green-sage) */
.info-box {
  background: var(--sage-pale);
  border-left: 4px solid var(--sage);
  padding: 16px 20px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 18px 0;
}
.info-box p { color: #2d6a4f; margin: 0; font-size: 13px; line-height: 1.6; }

/* Warning (red) */
.warning-box {
  background: var(--danger-pale);
  border-left: 4px solid var(--danger);
  padding: 16px 20px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 18px 0;
}
.warning-box p { color: var(--danger); margin: 0; font-size: 13px; line-height: 1.6; }

/* Gold/tip */
.gold-box {
  background: var(--gold-pale);
  border-left: 4px solid var(--gold);
  padding: 16px 20px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 18px 0;
}
.gold-box p { color: #7a5a00; margin: 0; font-size: 13px; line-height: 1.6; }
```

### Questions Box (dark, at bottom of each lesson)
```css
.questions-box {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);
  padding: 28px; border-radius: var(--radius); margin-top: 20px;
}
.questions-box h4 {
  color: var(--gold); font-family: var(--font-display);
  font-size: 18px; margin-bottom: 16px;
}
.questions-box ul { list-style: none; padding: 0; }
.questions-box ul li {
  color: rgba(255,255,255,0.85); font-size: 13px;
  padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
  display: flex; gap: 10px; align-items: flex-start; line-height: 1.5;
}
.questions-box ul li::before { content: "›"; color: var(--gold); font-weight: 700; font-size: 16px; flex-shrink: 0; }
```

---

## 9. DECISION TREE

### Progress Bar
```css
.progress-bar {
  background: var(--border); border-radius: 40px;
  height: 7px; overflow: hidden; margin-bottom: 8px;
}
.progress-fill {
  background: linear-gradient(90deg, var(--gold), var(--sage-light));
  height: 100%; border-radius: 40px; transition: width .5s ease;
}
```

### Question Card
```css
.tree-question {
  background: var(--white); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 32px; box-shadow: var(--shadow);
}
.tree-question h3 { font-family: var(--font-display); font-size: 22px; color: var(--navy); margin-bottom: 8px; }
```

### Option Cards
```css
.tree-option {
  background: var(--off-white); border: 2px solid var(--border);
  border-radius: var(--radius-sm); padding: 18px 20px;
  cursor: pointer; transition: all .2s;
  display: flex; align-items: center; gap: 16px;
}
.tree-option:hover { border-color: var(--gold); background: var(--gold-pale); }
.tree-option.selected { border-color: var(--navy); background: var(--navy); }
.tree-option.selected h4, .tree-option.selected p { color: white; }
.tree-option h4 { font-size: 14px; font-weight: 500; margin-bottom: 3px; }
.tree-option p { font-size: 12px; color: var(--text-muted); }
```

### Results Header
```css
.results-header {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%);
  padding: 40px 32px; border-radius: var(--radius);
  color: white; margin-bottom: 24px; text-align: center;
}
.results-header h2 { font-family: var(--font-display); font-size: 32px; margin-bottom: 10px; }
```

### Flag Alert (inside results-header for complex situations)
```css
.flag-alert {
  background: rgba(255,200,100,0.15);
  border: 1px solid rgba(255,200,100,0.4);
  border-radius: var(--radius-sm);
  padding: 14px 18px; margin-top: 16px;
  font-size: 13px; color: rgba(255,255,255,0.9); text-align: left;
}
```

---

## 10. STRATEGY CARDS (Expandable Accordion)

```css
.strategy-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 14px; overflow: hidden; box-shadow: var(--shadow); }
.strategy-header { padding: 20px 22px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background .15s; }
.strategy-header:hover { background: var(--slate-pale); }
.strategy-body { display: none; padding: 0 22px 22px; border-top: 1px solid var(--border); }
.strategy-body.open { display: block; }
.strategy-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.pro-icon { color: var(--sage); font-weight: 700; flex-shrink: 0; }
.con-icon { color: var(--danger); font-weight: 700; flex-shrink: 0; }
```

---

## 11. SCENARIO CARDS (Expandable Accordion)

```css
.scenario-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow); }
.scenario-header { padding: 20px 22px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
.scenario-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
/* Avatar background colors: scenario-specific (see data) */
.scenario-body { display: none; padding: 0 22px 22px; border-top: 1px solid var(--border); }
.scenario-body.open { display: block; }
```

---

## 12. PILLAR TABS (on Learn page)

```css
.pillar-tabs {
  display: flex; gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden; background: var(--white);
  margin-bottom: 24px;
}
.pillar-tab {
  flex: 1; padding: 12px 8px; background: none; border: none;
  font-family: var(--font-body); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all .2s;
  border-right: 1px solid var(--border); color: var(--text-secondary);
}
.pillar-tab:last-child { border-right: none; }
.pillar-tab.active { background: var(--navy); color: white; }
.pillar-tab:hover:not(.active) { background: var(--slate-pale); }
```

---

## 13. ADVISOR PAGE

### Advisor Cards
```css
.advisor-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 26px; box-shadow: var(--shadow); }
.advisor-icon { width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
/* Icon background colors per advisor type (from data) */
```

### Question Tabs
```css
.q-tab {
  background: var(--off-white); border: 1.5px solid var(--border);
  border-radius: 40px; padding: 7px 16px; font-size: 12px;
  font-weight: 500; cursor: pointer; transition: all .2s;
}
.q-tab.active { background: var(--navy); color: white; border-color: var(--navy); }
.q-tab:hover:not(.active) { border-color: var(--navy); background: var(--slate-pale); }
```

### Question List
```css
.q-list li {
  font-size: 14px; color: var(--text-secondary);
  padding: 11px 0; border-bottom: 1px solid var(--border);
  display: flex; gap: 12px; line-height: 1.55;
}
.q-num { color: var(--gold); font-weight: 600; flex-shrink: 0; }
```

### Prep Export Banner (dark, at bottom)
```css
.prep-export {
  background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%);
  border-radius: var(--radius); padding: 32px; text-align: center; color: white;
}
```

---

## 14. GLOSSARY

```css
.glossary-search {
  width: 100%; padding: 13px 18px;
  border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  font-family: var(--font-body); font-size: 15px; outline: none;
  background: var(--white); color: var(--text-primary); transition: border-color .2s;
}
.glossary-search:focus { border-color: var(--navy); }
.glossary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.glossary-item { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px 18px; box-shadow: var(--shadow); }
.glossary-item h4 { font-size: 13px; font-weight: 500; color: var(--navy); margin-bottom: 5px; }
.glossary-item p { font-size: 12px; color: var(--text-secondary); line-height: 1.55; }
```

---

## 15. CHECKLISTS

```css
.checklist-tabs { /* same pattern as pillar-tabs — see section 12 */ }
.checklist-section { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 26px; box-shadow: var(--shadow); }
.checklist-progress { background: var(--border); border-radius: 40px; height: 5px; margin-bottom: 4px; overflow: hidden; }
.checklist-progress-fill { background: var(--sage); height: 100%; border-radius: 40px; transition: width .4s ease; }
.checklist-item { display: flex; align-items: flex-start; gap: 14px; padding: 12px 4px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .15s; border-radius: 4px; }
.checklist-item:hover { background: var(--slate-pale); }
.checklist-checkbox { width: 20px; height: 20px; border-radius: 5px; border: 2px solid var(--border-dark); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: white; transition: all .2s; }
.checklist-checkbox.checked { background: var(--sage); border-color: var(--sage); }
.checklist-item.done .checklist-item-text { color: var(--text-muted); text-decoration: line-through; }
```

---

## 16. MODAL (Prep Sheet)

```css
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: white; border-radius: var(--radius); max-width: 680px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.modal-header { background: var(--navy); padding: 24px 28px; border-radius: var(--radius) var(--radius) 0 0; display: flex; align-items: center; justify-content: space-between; }
.modal-header h3 { font-family: var(--font-display); font-size: 22px; color: white; }
.modal-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 24px; cursor: pointer; }
.modal-close:hover { color: white; }
.modal-body { padding: 28px; }
```

---

## 17. DATA TABLES (inside lesson content)

```css
.lesson-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
.lesson-content table th { background: var(--navy); color: white; padding: 10px 14px; text-align: left; font-weight: 500; font-size: 12px; }
.lesson-content table td { padding: 10px 14px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
.lesson-content table tr:last-child td { border-bottom: none; }
.lesson-content table tr:nth-child(even) td { background: var(--slate-pale); }
```

---

## 18. HERO SECTION

```css
.hero { text-align: center; padding: 48px 20px 40px; background: linear-gradient(180deg, rgba(15,31,61,0.04) 0%, transparent 100%); border-radius: var(--radius); }
.hero-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-pale); border: 1px solid var(--gold-light); color: var(--navy); font-size: 11px; font-weight: 500; padding: 5px 14px; border-radius: 40px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: .6px; }
```

---

## 19. SPACING & DIVIDERS

```css
.divider { height: 1px; background: var(--border); margin: 28px 0; }
.section-title { font-family: var(--font-display); font-size: 26px; color: var(--navy); margin-bottom: 8px; }
.section-sub { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
```

---

## 20. INTERACTION RULES

- **Hover on cards:** `border-color: var(--gold)` + `box-shadow: var(--shadow-lg)` + `transform: translateY(-2px)`
- **Active tab:** `background: var(--navy); color: white`
- **Selected option (tree):** `border-color: var(--navy); background: var(--navy)` — text becomes white
- **Checked checkbox:** `background: var(--sage); border-color: var(--sage)` — show white SVG checkmark
- **All transitions:** `transition: all .2s`
- **Progress bars:** `transition: width .5s ease` (tree) or `.4s ease` (checklist)
- **Buttons:** hover triggers `transform: translateY(-1px)` on primary/gold buttons

---

## 21. GLOBAL RULES (do not violate)

1. **Body background is always `var(--off-white)` (#fafaf8)** — never white or gray
2. **Cards are always white** with the standard border and shadow
3. **Disclaimer banner is never removed** — always below nav, always on every page view
4. **Font families must never fall back to system defaults** — always load the Google Fonts
5. **Navy is only used as a background for headers, nav, dark sections** — not for body copy
6. **Gold is used for accents, CTAs, and highlights** — not for large background areas
7. **All border-radius values come from the CSS variables** — `--radius`, `--radius-sm`, `--radius-lg`
8. **No inline color values** — always use CSS custom properties
9. **Box shadows use the two defined levels only** — `--shadow` and `--shadow-lg`
10. **Section titles use Playfair Display; UI text uses DM Sans** — never mix them on the same element

---

## 22. CURSOR PROMPT TEMPLATE

When asking Cursor to build or fix a component, use this template:

```
Build a [component name] following the PlanWise Guide design system (DESIGN_SYSTEM.md).

Rules:
- Font: Playfair Display for headings, DM Sans for body/UI
- Colors: use only CSS custom properties from :root (--navy, --gold, --sage, etc.)
- Cards: white bg, 1px solid var(--border), border-radius: var(--radius), box-shadow: var(--shadow)
- Hover: border-color: var(--gold) + shadow-lg + translateY(-2px)
- Active states: background: var(--navy); color: white
- Complexity badges: .c-foundation (green), .c-intermediate (amber), .c-advanced (red)
- All callout boxes have a 4px left border and matching pale background
- Dark sections use linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 100%)
- No inline styles, no hardcoded hex values

The component should match this spec: [describe your component here]
```
