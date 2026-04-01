-- ============================================================
-- Migration: 20260401000004_terms_app_config_seed
-- Seeds terms_version and terms_sections into app_config.
-- Uses ON CONFLICT DO NOTHING so existing production rows
-- are never overwritten by a re-run.
-- ============================================================

INSERT INTO app_config (key, value, description)
VALUES (
  'terms_version',
  '2026-03-31',
  'Current T&C version string. Update this to re-gate all users on next login.'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES (
  'terms_sections',
  '[
    {"title":"1. Acceptance of Terms","body":"By creating an account and using Estate Planner (\"the Platform\"), you agree to be bound by these Terms and Conditions (\"Terms\"). If you do not agree to these Terms, you may not access or use the Platform. These Terms constitute a legally binding agreement between you and Estate Planner."},
    {"title":"2. Financial Disclaimer","body":"Estate Planner is an informational and organizational tool only. Nothing on the Platform constitutes financial, legal, tax, or investment advice. The Platform does not recommend or endorse any specific financial product, investment strategy, attorney, or advisor. Any information provided is for general educational purposes only. You should consult a qualified financial advisor, attorney, or tax professional before making any financial or legal decisions. Estate Planner is not a registered investment advisor, broker-dealer, or law firm."},
    {"title":"3. Data Privacy & Storage","body":"Estate Planner collects and stores personal and financial information you provide in order to deliver the Platform''s services. Your data is stored securely using industry-standard encryption at rest and in transit. We do not sell your personal information to third parties. We may share data with service providers necessary to operate the Platform (such as payment processors and email providers) under strict confidentiality obligations. You may request deletion of your account and associated data at any time by contacting support. By using the Platform you consent to the collection and use of your data as described in our Privacy Policy, which is incorporated into these Terms by reference."},
    {"title":"4. Subscription & Billing","body":"Access to certain features of the Platform requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis depending on the plan selected. All fees are non-refundable except as required by law or as expressly stated in our refund policy. Estate Planner reserves the right to change pricing with thirty (30) days notice. If your payment fails, access to paid features may be suspended until payment is resolved. Subscriptions may be cancelled at any time; cancellation takes effect at the end of the current billing period. If your account is managed by an advisor, billing terms may differ as outlined during onboarding."},
    {"title":"5. User Responsibilities","body":"You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to provide accurate, current, and complete information and to update it as necessary. You agree not to use the Platform for any unlawful purpose or in any way that could damage, disable, or impair the Platform. You may not attempt to gain unauthorized access to any part of the Platform or its related systems. You are solely responsible for the accuracy of any financial or personal data you enter into the Platform."},
    {"title":"6. Limitation of Liability","body":"To the fullest extent permitted by applicable law, Estate Planner and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform, even if advised of the possibility of such damages. In no event shall Estate Planner''s total liability to you for all claims exceed the greater of (a) the amount you paid to Estate Planner in the twelve (12) months preceding the claim, or (b) one hundred dollars ($100). Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so some of the above limitations may not apply to you."},
    {"title":"7. Governing Law","body":"These Terms shall be governed by and construed in accordance with the laws of the State of Washington, without regard to its conflict of law provisions. Any dispute arising under or related to these Terms shall be subject to the exclusive jurisdiction of the state and federal courts located in Washington State. You consent to personal jurisdiction in such courts and waive any objection to venue."},
    {"title":"8. Changes to These Terms","body":"Estate Planner reserves the right to modify these Terms at any time. When we make material changes, we will update the version date and require you to re-accept the Terms before continuing to use the Platform. Your continued use of the Platform after any changes constitutes acceptance of the revised Terms. The current version of these Terms is always available at /terms."}
  ]',
  'T&C section content as JSON array. Each item has title and body. Edit via admin portal T&C tab.'
)
ON CONFLICT (key) DO NOTHING;
