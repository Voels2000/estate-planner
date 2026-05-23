-- Sprint 9–10 deploy-critical columns
-- Apply before enabling layout invite-advisor gate or succession intake in prod.

-- ── 1. Advisor connection life-event snapshot (Sprint 9) ─────────────────────
alter table public.advisor_clients
  add column if not exists connection_life_event_type text,
  add column if not exists connection_life_event_at timestamptz;

comment on column public.advisor_clients.connection_life_event_type is
  'Event slug at accept: funnel_events.event_slug, referral_clicks.event_slug, or life_events fallback.';
comment on column public.advisor_clients.connection_life_event_at is
  'When connection_life_event_type was captured.';

-- ── 2. Invite-advisor onboarding gate (Sprint 10) — REQUIRED on profiles ───
alter table public.profiles
  add column if not exists onboarding_invite_advisor_completed_at timestamptz;

comment on column public.profiles.onboarding_invite_advisor_completed_at is
  'Set when consumer finishes /onboarding/invite-advisor (invite, find-advisor, or skip). NULL = gate active. Skip uses the same timestamp as complete (dismissed = seen).';

-- ── 3. Minimal business succession intake (Sprint 10) ───────────────────────
alter table public.households
  add column if not exists succession_plan_in_place boolean,
  add column if not exists succession_key_person_identified boolean,
  add column if not exists succession_buy_sell_in_place boolean;

comment on column public.households.succession_plan_in_place is
  'Minimal business succession intake: documented succession plan exists.';
comment on column public.households.succession_key_person_identified is
  'Minimal business succession intake: key-person dependency identified.';
comment on column public.households.succession_buy_sell_in_place is
  'Minimal business succession intake: buy-sell agreement in place.';
