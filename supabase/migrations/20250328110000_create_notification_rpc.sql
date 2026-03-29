-- RPC for cron/notifications: insert in-app notification unless same type was sent within cooldown.

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_delivery text default 'both',
  p_metadata jsonb default '{}'::jsonb,
  p_cooldown text default '7 days'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_cooldown interval;
  v_id uuid;
begin
  v_cooldown := coalesce(nullif(trim(p_cooldown), ''), '7 days')::interval;

  select max(created_at) into v_last
  from public.notifications
  where user_id = p_user_id
    and type = p_type;

  if v_last is not null and v_last > now() - v_cooldown then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    p_user_id,
    p_type,
    p_title,
    p_body,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.create_notification(uuid, text, text, text, text, jsonb, text) is
  'Creates a notification row if no recent notification of the same type exists (cooldown). Returns null when skipped.';

grant execute on function public.create_notification(uuid, text, text, text, text, jsonb, text) to service_role;

alter table public.profiles
  add column if not exists subscription_renewal_date timestamptz;
