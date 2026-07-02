# Attorney marketing kit — usage tips (shipped)

Static **"Share when…"** guidance for `/attorney/marketing` link kit.
Source: `lib/attorney/attorneyEventReferralKit.ts` → `ATTORNEY_EVENT_REFERRAL_USAGE_TIPS`.

Replaces first-subhead truncation (consumer page copy). Unit test asserts all 24
`buildAllAttorneyEventReferralUrls` slugs have a tip.

## Slug audit (draft → codebase)

Verified against `lib/events/referral.ts`, `lib/events/content.ts`, and
`ATTORNEY_EVENT_REFERRAL_LABELS`. **23/24** draft slugs matched as-is.

| Draft slug | Actual slug | Notes |
|------------|-------------|--------|
| `rsu-vest-liquidity-event` | **`large-rsu-vest`** | Only mismatch — label is still "Large RSU vest / liquidity event" |
| All other 23 | Same | Including `divorce` (unquoted key in TS) |

Draft grouped `selling-a-home` and `multi-state-real-estate` under "Family" in the
spreadsheet; in the app they live under **Real Estate & Inheritance** (slug unchanged).

## Voice pass (vs draft)

- Pattern: **Share when / after / before / early / once / as / around / whenever / on** + em dash + estate-planning angle.
- Light edits from draft: plain language (`do not` vs `don't` in one tip), `minor trust` (not "minor's trust"), `faces` vs `is confronting` for serious diagnosis.
- `estate-tax-law-change` tip is timeless (draft); public subhead still references TCJA 2018 — tip intentionally does not.

## Adding a new event

1. Add slug to `lib/events/referral.ts` + event content.
2. Add label to `ATTORNEY_EVENT_REFERRAL_LABELS` and group in `ATTORNEY_EVENT_REFERRAL_GROUPS`.
3. Add tip to `ATTORNEY_EVENT_REFERRAL_USAGE_TIPS` — test will fail if missing.
