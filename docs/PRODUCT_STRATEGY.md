# PRODUCT_STRATEGY.md
# My Wealth Maps — Product Strategy Reference
# Last updated: May 2026 (Session with full UX + strategy review)

---

## ⚡ Quick context block — paste this at the start of every new AI session

> My Wealth Maps is a self-guided estate and financial planning tool for households with $2M–$30M in assets. This segment is severely underserved — banks sell products instead of planning, attorneys are reactive not proactive, and consumer tools like LegalZoom are too simple for this level of complexity. Over 50% of our target users have no will or estate plan at all. Our product is the first tool built specifically for the complexity of this segment, at a price point this segment can justify ($50–200/month vs $5K–50K in annual professional fees). We have three paid tiers (Financial, Retirement, Estate) and a public-facing site with education, assessment, advisor directory, and attorney directory. The advisor and attorney network is a core part of the model — we make their clients better prepared, which makes us their referral partner, not their competitor. Current sprint: Sprint 2 — Life event landing pages (see [ROADMAP.md](./ROADMAP.md) and [NEXT_SESSION.md](./NEXT_SESSION.md)). Sprint 1 shipped app/public nav separation and upgrade-gate personalization.

---

## The market gap we own

| Segment | Assets | Who serves them | Gap |
|---------|--------|-----------------|-----|
| Mass market | Under $500K | Betterment, LegalZoom, Mint | Well served — simple needs |
| **Our target** | **$2M – $30M** | **Nobody well** | **Severely underserved — complex needs, no coordinated planning tool** |
| Ultra HNW | $30M – $100M | Multi-family offices, private banks | Expensive but served |
| Family office | $100M+ | Dedicated family offices | Fully resourced, not our market |

**The structural reasons this segment is underserved:**
- Banks optimize for AUM fees, not planning outcomes — estate planning doesn't generate AUM revenue
- Estate attorneys are reactive — they draft documents when asked, don't monitor ongoing plan health
- Consumer tools break down at business interests, multiple RE holdings, illiquid assets, state estate tax complexity
- Advisor tools (Orion, Addepar, eMoney) are advisor-first — clients get PDFs, not a living dashboard

**The statistic that defines our opportunity:** Over 50% of households in the $2M–$30M range have no will or estate plan at all.

---

## Target personas

### The business owner ($3M–$15M · Age 50–65)
Business is 60–80% of net worth — illiquid and hard to value. No succession plan. Will from 2012, before the business was worth this much. Estate tax exposure growing every year.
Key life event triggers: approaching retirement, acquisition offer, adding a business partner, health scare.

### The real estate accumulator ($2M–$20M · Age 45–70)
Multiple properties — primary home, vacation, rentals, commercial. Titles inconsistent across personal names, LLCs. Properties intended for different children but no formal plan. Multi-state probate risk.
Key life event triggers: selling a major property, spouse death, child reaching adulthood.

### The executive / sudden wealth ($2M–$10M · Age 40–60)
Large RSU vests, stock options, deferred compensation. Wealth accumulated faster than planning kept up. Basic will but no trust, no gifting strategy. Estate tax exposure grew suddenly.
Key life event triggers: large RSU vest, IPO/acquisition, job change, divorce.

---

## The three-tier pricing model

| Tier | What's included | Target persona |
|------|-----------------|----------------|
| **Financial** (Tier 1) | Profile, dashboard, income, expenses, assets, real estate, businesses, digital assets, liabilities, insurance, projections, scenarios | Entry point — anyone wanting a financial picture |
| **Retirement** (Tier 2) | Everything in Tier 1 + Social Security, RMD Calculator, Roth Conversion, Lifetime Snapshot, Monte Carlo, Asset Allocation, My Attorney | Pre-retirees and retirees |
| **Estate** (Tier 3) | Everything in Tiers 1+2 + My Family, Titling & Beneficiaries, Incapacity Planning, Domicile Analysis, Estate Tax Snapshot, Estate Horizons, Gifting/Strategies/Trusts | Primary target — the $2M–$30M estate planning need |

**Pricing philosophy:** This segment pays $5K–$50K for estate attorney work annually. A $50–200/month planning tool is a rounding error on their professional services spend. Price as professional planning infrastructure, not a consumer app. Never price-compare to LegalZoom.

---

## Two-zone product architecture

### Zone 1 — Public site (anonymous visitors)
Routes: `/`, `/education`, `/assess`, `/find-advisor`, `/find-attorney`, `/pricing`
Nav: Clean top nav only — no sidebar. One goal: convert visitors to accounts.
The assessment is the primary conversion mechanism — generates a personalized score before login, gates the full breakdown behind account creation.

### Zone 2 — Planning app (authenticated subscribers)
Routes: `/dashboard`, `/income`, `/assets`, `/estate-tax`, etc.
Nav: Sidebar with three planning groups (Financial, Retirement, Estate) only. Zero public-site links in the app nav. Connections (advisor, attorney) in footer.
Tier structure visible in sidebar — locked tiers show representative items with upgrade CTAs, not empty space.

---

## The advisor and attorney network — our moat

Advisors and attorneys are not competitors. They are distribution partners and value multipliers.

- **For advisors:** A client who arrives with a completed household data profile, a current estate tax snapshot, and specific questions about GRAT vs SLAT timing can do a $3,000 meeting in 90 minutes instead of 3 hours. That advisor becomes our best salesperson.
- **For attorneys:** We generate better-prepared clients and reduce their intake time. They refer clients to us because we make their relationships more productive.
- **The flywheel:** Advisor refers client → client connects advisor in app → advisor sees live plan → advisor recommends strategies → consumer accepts recommendations → estate health improves → advisor looks good → advisor refers more clients.

**Key principle:** "Invite your advisor" should be a primary onboarding step, not buried in settings.

---

## Life event strategy — the front door

Nobody wakes up wanting estate planning software. They wake up having just sold a business, lost a parent, received a diagnosis, or gotten divorced.

Life events are the primary acquisition mechanism for the public site. Each event page:
- Explains what changes at the $2M–$30M level specifically (not generic advice)
- Has a 5-question event-specific assessment
- Gates the full result behind account creation
- Surfaces both advisor and attorney CTAs
- Is SEO-optimized for "[event] + estate planning" keywords

**Priority events (highest urgency for our segment):**
1. Selling a business
2. Death of a spouse
3. Serious health diagnosis
4. Receiving an inheritance
5. Divorce
6. Approaching retirement
7. Large RSU vest / liquidity event
8. New child or grandchild

---

## UX principles — the decisions that must survive sprint transitions

**1. Complexity is the differentiator, not a bug to fix.**
LegalZoom handles simple. Family offices handle $30M+. We own the $2M–$30M complexity gap. Never simplify away from that. When a feature feels complex, add guided context — don't remove depth. A business owner modeling a GRAT wants to understand the §7520 Rate. Explain it, don't hide it.

**2. The conflict alerts are the product.**
The named, specific conflict alerts ("4 accounts missing beneficiaries: Yukon Denali 2019, Kubota Tractor…") are more valuable than any calculator. For this segment, knowing their specific problems by name — not a generic score — is the core value. These must be above the fold on the dashboard, not buried after 4 scrolls.

**3. Treat users as sophisticated.**
Remove language like "simple rule-of-thumb teaser," "illustrative mix," and "not investment advice" from prominent positions. This segment has advisors and attorneys. They want a tool that respects the complexity of their situation, not one that apologizes for showing them real numbers.

**4. The professional network is core, not optional.**
Advisor and attorney connections belong in the primary onboarding flow. The shared workspace — where an advisor can see a client's plan health and recommend strategies the client accepts or rejects — is a key differentiator.

**5. Meet people at the moment, not the product.**
Life events are the front door. The planning app is what they find inside. Every public event page should make a person in that situation feel immediately understood and directed to action.

**6. One source of truth per question.**
Never duplicate information across documents. Use cross-references instead. This applies to the product docs and to the product itself — one place to see estate tax exposure, one place to log gifts, one place to manage strategies.

---

## What we are not building

- A mass-market consumer tool (not competing with Mint, Betterment, LegalZoom)
- A replacement for attorneys or advisors (we prepare clients for those relationships)
- A tool for $30M+ estates (family offices have different needs and resources)
- An investment management platform (we are a planning and coordination tool)

---

## Document relationships

| Question | Answer lives in |
|----------|-----------------|
| Why are we building this? | This document (PRODUCT_STRATEGY.md) |
| What decisions have been made and why? | DECISION_LOG.md |
| What are we building and when? | ROADMAP.md |
| What is the current session working on? | NEXT_SESSION.md |
| How do consumers navigate the app? | CONSUMER_NAV_MAP.md |
| How do specific features work end-to-end? | CONSUMER_FLOWS.md |
| How is the system architected? | MASTER_ARCHITECTURE.md |
| What does the database look like? | DATABASE_SCHEMA_REFERENCE.md |
| What changed in which session? | SCHEMA_CHANGELOG.md |
| How do we verify a release? | CONSUMER_RELEASE_SMOKE_TEST.md |
| What needs updating before a merge? | UPDATE_CHECKLIST.md |
