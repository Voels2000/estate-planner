# Attorney portal — Marketing tab (newsletter kit relocation)

New top-level nav tab: Clients / Requests / Billing / **Marketing** / Firm settings.
Replaces the newsletter kit section previously embedded at the bottom of the Clients tab.

**Route:** `/attorney/marketing`

## Shipped behavior

### Navigation

- `AttorneyNav` — Marketing tab between Billing and Firm settings.
- Newsletter kit **removed** from `/attorney` (Clients) dashboard.

### Framing copy

Opening line (aligned with outreach life-event hook):

> Your existing clients hit life events too — a business sale, a new grandchild, a move to a new state. Share the right link when it happens, and stay the attorney they call.

### Click stats (`referral_clicks`)

- **API:** `GET /api/attorney/referral-stats`
- **Lib:** `lib/attorney/attorneyReferralStats.ts`
- All-time total, trailing 30 days, per-slug counts, per-category counts, most-clicked slug.
- Query: `listing_type = 'attorney'`, `attorney_listing_id`, `resolved = true` — **all historical rows**, not scoped to feature ship date.
- `event_slug` on each row powers per-link badges.

### Curated bundle ("This quarter's newsletter")

- **With click history:** top 3 slugs by volume.
- **Without click history:** editorial default — `selling-a-business`, `new-child-grandchild`, `estate-tax-law-change`.
- Copy button exports a short newsletter snippet.

### Per-link usage tips

Static attorney-facing **"Share when…"** copy in `ATTORNEY_EVENT_REFERRAL_USAGE_TIPS`
(`lib/attorney/attorneyEventReferralKit.ts`) — not derived from public event subheads.
See [ATTORNEY_MARKETING_USAGE_TIPS.md](./ATTORNEY_MARKETING_USAGE_TIPS.md). Unit test
asserts every referral slug has a tip.

### Format tabs

All Links / Email Copy / Plain Text — unchanged from prior Clients-tab implementation; shared builders in `lib/attorney/attorneyEventReferralKit.ts`.

## Not addressed here

- Consumer-facing referral performance on `/find-attorney`
- Advisor Marketing tab (advisor kit remains on advisor portal)
