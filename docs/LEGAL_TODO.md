# LEGAL_TODO.md
# Items requiring legal review before go-live
# Created: Sprint C-5

## Counsel handoff — how to send the ToS

When you send the Terms of Service to counsel:

1. **Flag these three sections explicitly** — they are the ones most likely to need Washington-specific adjustments:
   - **Section 10** (Disclaimers)
   - **Section 11** (Limitation of Liability)
   - **Section 13** (Dispute Resolution / Arbitration)
2. **Ask for a single consolidated redline** — not separate comment threads. One clean pass back is faster to implement than threading multiple rounds.
3. **Batch the code changes in one final pre-go-live commit:**
   - Apply counsel's redlines to `lib/legal/terms-of-service-sections.ts` (and Privacy Policy if included in the same review).
   - Replace the three TODO placeholders (`[COMPANY LEGAL NAME]`, `[COMPANY ADDRESS]`, `[REGISTERED AGENT NAME AND ADDRESS]`) in `/privacy` and `/terms` — a ~5-minute find-and-replace once your entity name is confirmed. **Do not** do placeholders in a separate commit before counsel returns; drop them in with the redlines.
   - Sync `app_config.terms_sections` in Supabase for `/terms/accept` in the same commit.

**Source files:** `lib/legal/terms-of-service-sections.ts`, `lib/legal/privacy-policy-sections.ts`

---

## Must complete before PUBLIC_SIGNUP_OPEN=true

- [ ] Replace TODO placeholders + apply counsel redlines — **one commit** (see [Counsel handoff](#counsel-handoff--how-to-send-the-tos) above):
  - TODO: [COMPANY LEGAL NAME] in /privacy and /terms
  - TODO: [COMPANY ADDRESS] in /privacy and /terms
  - TODO: [REGISTERED AGENT NAME AND ADDRESS] — Privacy Policy Section 13
- [ ] Legal review of full Terms of Service — flag §10, §11, §13 to counsel; request consolidated redline:
  - Section 10 (Disclaimers) — confirm scope with counsel
  - Section 11 (Limitation of Liability) — confirm cap amount with counsel
  - Section 13 (Dispute Resolution / Arbitration) — confirm AAA rules and venue
  - Section 13.3 (Class Action Waiver) — confirm enforceability in WA
- [ ] Legal review of Privacy Policy — particularly:
  - Section 4 (WCPA legal basis) — confirm with WA-licensed counsel
  - Section 10 (Breach notification) — confirm 30-day timeline with counsel
- [ ] Create privacy@mywealthmaps.com email address (or alias)
- [ ] Create security@mywealthmaps.com email address (or alias)
- [ ] Create legal@mywealthmaps.com email address (or alias)
- [ ] Update app_config.terms_sections in Supabase with final ToS content
  (in-app accept at `/terms/accept` — include in the same commit as counsel redlines + placeholders)
- [ ] Confirm refund policy with counsel (Section 5.4 currently says no refunds)
- [ ] Privacy Policy and ToS links verified in footer on both public and dashboard layouts

## Can complete post-launch (within 30 days)

- [ ] WCPA consumer rights request flow — email handler at privacy@mywealthmaps.com
- [ ] Data retention automation — 30-day deletion after account close
- [ ] Cookie consent banner (low priority — no advertising cookies used)
