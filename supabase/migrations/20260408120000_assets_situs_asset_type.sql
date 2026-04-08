-- Sprint 64: situs tracking for multi-state estate tax (companion to situs_state)
alter table public.assets
  add column if not exists situs_asset_type text;
