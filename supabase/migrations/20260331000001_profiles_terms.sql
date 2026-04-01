-- Migration: add terms acceptance fields to profiles
-- Supports Terms & Conditions acceptance flow added in Sprint 33.
-- terms_accepted_at:  timestamp when user accepted the current T&C version
-- terms_version:      version string of the T&C accepted (date-based, e.g. '2026-03-31')

alter table public.profiles
  add column if not exists terms_accepted_at  timestamptz,
  add column if not exists terms_version      text;
