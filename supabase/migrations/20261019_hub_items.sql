-- Applied to project lcmnkcpkbkrktediyvpo (my-life-system) on 2026-10-19.
-- Every app of the ecosystem keeps its records here; the hub assistant writes, each app reads its own slice (app = 'lang', 'money', ...).
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  data jsonb not null default '{}'::jsonb,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index items_user_app_created_idx on public.items (user_id, app, created_at desc);

alter table public.items enable row level security;

-- The hub has a single owner: the first account created in this project.
-- Callable by signed-in users on purpose (the assistant function asks it); it only tells the caller whether they are the owner.
create function public.is_hub_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.uid() = (select u.id from auth.users u order by u.created_at limit 1), false);
$$;

revoke execute on function public.is_hub_owner() from public, anon;
grant execute on function public.is_hub_owner() to authenticated;

create policy "owner manages own items"
  on public.items for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_hub_owner()))
  with check ((select auth.uid()) = user_id and (select public.is_hub_owner()));

revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;
