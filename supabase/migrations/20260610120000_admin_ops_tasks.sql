-- Admin-A: ops_tasks obligation tracker + cron_health last-run tracking

CREATE TABLE IF NOT EXISTS public.ops_tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  description         text,
  cadence             text NOT NULL CHECK (cadence IN ('daily','weekly','monthly','quarterly','annual','once')),
  next_due_at         timestamptz NOT NULL,
  last_completed_at   timestamptz,
  last_completed_by   text,
  completion_method   text,
  completion_notes    text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','due','overdue','completed','snoozed')),
  auto_complete       boolean DEFAULT false,
  script_command      text,
  category            text NOT NULL DEFAULT 'compliance'
                      CHECK (category IN ('compliance','legal','security','ops','billing')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cron_health (
  job_name              text PRIMARY KEY,
  last_run_at           timestamptz,
  last_status           text CHECK (last_status IN ('ok','warning','error','unknown')),
  last_message          text,
  consecutive_failures  int NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ops_tasks"
  ON public.ops_tasks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role manages cron_health"
  ON public.cron_health FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT ALL ON public.ops_tasks TO service_role;
GRANT ALL ON public.cron_health TO service_role;

INSERT INTO public.ops_tasks (slug, title, description, cadence, next_due_at, category, auto_complete, script_command) VALUES
('ux-language-audit',
 'UX language audit',
 'Run scripts/audit-ux-language.sh — confirm 0 compliance language findings',
 'weekly',
 date_trunc('week', now()) + interval '7 days',
 'compliance', true, 'bash scripts/audit-ux-language.sh'),

('launch-gate-review',
 'Launch Gate review',
 'Open docs/LAUNCH.md — confirm no new blockers added, check attorney drip steps',
 'weekly',
 date_trunc('week', now()) + interval '7 days',
 'ops', false, NULL),

('security-audit',
 'Security audit script',
 'Run scripts/security-audit.sh — review output for new findings',
 'monthly',
 date_trunc('month', now()) + interval '1 month',
 'security', false, 'bash scripts/security-audit.sh'),

('soft-deleted-auth-review',
 'Soft-deleted auth users review',
 'SQL: SELECT id, email FROM auth.users WHERE deleted_at IS NOT NULL — should be 0',
 'monthly',
 date_trunc('month', now()) + interval '1 month',
 'compliance', false,
 'SELECT id, email, deleted_at FROM auth.users WHERE deleted_at IS NOT NULL'),

('audit-log-review',
 'Deletion audit log review',
 'Admin → Data & Compliance → review deletion_audit_log for failures or anomalies',
 'monthly',
 date_trunc('month', now()) + interval '1 month',
 'compliance', false, NULL),

('rls-verify-full',
 'Full RLS verification',
 'Run npm run verify:rls --require-sql — confirm 0 invariant failures',
 'monthly',
 date_trunc('month', now()) + interval '1 month',
 'security', true, 'npm run verify:rls --require-sql'),

('tos-privacy-counsel-review',
 'ToS and Privacy Policy counsel review',
 'Send current /terms and /privacy to counsel — confirm no material changes needed',
 'quarterly',
 date_trunc('quarter', now()) + interval '3 months',
 'legal', false, NULL),

('bo-tax-filing',
 'Washington B&O tax filing',
 'File quarterly B&O return with WA DOR — gross revenue this quarter',
 'quarterly',
 date_trunc('quarter', now()) + interval '3 months',
 'billing', false, NULL),

('dpa-vendor-review',
 'DPA vendor review',
 'Review Supabase, Vercel, Resend, Stripe DPA status — confirm all current',
 'annual',
 date_trunc('year', now()) + interval '1 year',
 'legal', false, NULL),

('business-license-renewal',
 'WA business license renewal',
 'Renew WA Secretary of State annual report + business license',
 'annual',
 date_trunc('year', now()) + interval '1 year',
 'legal', false, NULL),

('first-signup-verify',
 'First real signup verification',
 'Verify first signup in Supabase auth.users — confirm drip step 1 delivered in Resend',
 'once',
 now() + interval '1 day',
 'ops', false, NULL),

('drip-step2-verify',
 'Drip step 2 verification',
 'Run npm run verify:drip — confirm step 2 scheduled for first real signup (day 3+)',
 'once',
 now() + interval '4 days',
 'ops', false, 'npm run verify:drip'),

('wa-sales-tax-position',
 'WA SaaS sales tax position',
 'Confirm DOR ruling or attorney opinion on SaaS retail sales tax obligation before first WA subscriber payment',
 'once',
 now(),
 'legal', false, NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.cron_health (job_name, last_status) VALUES
  ('notifications', 'unknown'),
  ('compliance-reminders', 'unknown'),
  ('process-deletions', 'unknown'),
  ('age-triggers', 'unknown'),
  ('post-deploy-verify', 'unknown')
ON CONFLICT (job_name) DO NOTHING;

COMMENT ON TABLE public.ops_tasks IS 'Calendar compliance obligations — seeded from COMPLIANCE_CALENDAR + LAUNCH.md Bucket D.';
COMMENT ON TABLE public.cron_health IS 'Last-run status per Vercel cron job for Admin Ops Home.';
