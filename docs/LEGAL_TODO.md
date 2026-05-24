# LEGAL_TODO.md
# Items requiring legal review before go-live
# Created: Sprint C-5

## Must complete before PUBLIC_SIGNUP_OPEN=true

- [ ] Replace TODO: [COMPANY LEGAL NAME] in /privacy and /terms with actual entity name
- [ ] Replace TODO: [COMPANY ADDRESS] in /privacy and /terms with actual registered address
- [ ] Add Washington registered agent name and address to Privacy Policy Section 13 (currently TODO: [REGISTERED AGENT NAME AND ADDRESS])
- [ ] Legal review of full Terms of Service — particularly:
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
  (currently used for in-app ToS display at /terms/accept — sync with /terms page after legal review)
- [ ] Confirm refund policy with counsel (Section 5.4 currently says no refunds)
- [ ] Privacy Policy and ToS links verified in footer on both public and dashboard layouts

## Can complete post-launch (within 30 days)

- [ ] WCPA consumer rights request flow — email handler at privacy@mywealthmaps.com
- [ ] Data retention automation — 30-day deletion after account close
- [ ] Cookie consent banner (low priority — no advertising cookies used)
