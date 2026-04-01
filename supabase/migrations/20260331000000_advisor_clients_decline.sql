-- Migration: add decline fields to advisor_clients
-- Supports the decline flow added in Sprint 33.
-- declined_at:  timestamp when advisor declined the request
-- declined_by:  advisor user id who performed the decline (FK to auth.users)
-- 'declined' is a new terminal state added alongside existing statuses.

alter table public.advisor_clients
  add column if not exists declined_at  timestamptz,
  add column if not exists declined_by  uuid references auth.users(id);

-- Drop and replace the status check constraint with the full set of known values.
-- Existing values in production: pending, active, consumer_requested, removed.
-- New value added here: declined.
alter table public.advisor_clients
  drop constraint if exists advisor_clients_status_check;

alter table public.advisor_clients
  add constraint advisor_clients_status_check
  check (status in ('pending', 'active', 'consumer_requested', 'removed', 'declined'));
