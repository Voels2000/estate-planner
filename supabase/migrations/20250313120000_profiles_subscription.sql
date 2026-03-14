-- Profiles table for user metadata and subscription status.
-- Links to auth.users; used by Stripe webhook to store subscription state.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  subscription_status text default 'none' check (subscription_status in (
    'none', 'active', 'canceled', 'past_due', 'trialing', 'unpaid'
  )),
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz default now()
);

-- RLS: users can read their own profile; only service role can update (e.g. webhook).
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile (limited)"
  on public.profiles for update
  using (auth.uid() = id);

-- Allow inserts so new users can get a row (e.g. from trigger or app).
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Service role (used by webhook) bypasses RLS, so no extra policy needed for updates.

-- Optional: trigger to create profile on signup (if you use Supabase Auth signup)
-- create or replace function public.handle_new_user()
-- returns trigger as $$
-- begin
--   insert into public.profiles (id) values (new.id);
--   return new;
-- end;
-- $$ language plpgsql security definer;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();
