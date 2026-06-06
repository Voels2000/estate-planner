-- Advisor export branding: profiles columns read by fetchAdvisorProfile → resolveAdvisorBranding
-- (PDF cover, meeting brief, Excel export). phone may already exist from 20250314100000.

alter table public.profiles
  add column if not exists phone text null,
  add column if not exists firm_name text null,
  add column if not exists firm_logo_url text null;

comment on column public.profiles.firm_name is
  'Advisor firm display name for PDF/brief branding (resolveAdvisorBranding fallback: My Wealth Maps)';

comment on column public.profiles.firm_logo_url is
  'Optional advisor firm logo URL for future PDF cover rendering';
