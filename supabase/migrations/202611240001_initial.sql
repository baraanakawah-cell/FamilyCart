create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Family member',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_id_idx on public.family_members(user_id);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code_digest bytea not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);
create index family_invites_family_id_idx on public.family_invites(family_id);
create unique index family_invites_one_active_per_family_idx
  on public.family_invites(family_id)
  where revoked_at is null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_nl text not null unique,
  name_en text not null,
  name_ar text not null,
  emoji text not null default '🛒',
  sort_order smallint not null default 0
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  quantity numeric(9,2) not null default 1 check (quantity > 0),
  unit text check (unit is null or char_length(unit) <= 24),
  note text check (note is null or char_length(note) <= 500),
  category_id uuid not null references public.categories(id),
  is_urgent boolean not null default false,
  is_favorite boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  purchased_at timestamptz,
  purchased_by uuid references public.profiles(id)
);
create index shopping_items_family_active_idx on public.shopping_items(family_id, created_at desc) where purchased_at is null;
create index shopping_items_history_idx on public.shopping_items(family_id, purchased_at desc) where purchased_at is not null;
create unique index shopping_items_unique_active_name_idx
  on public.shopping_items(family_id, lower(trim(name)))
  where purchased_at is null;

create table public.purchase_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  item_id uuid references public.shopping_items(id) on delete set null,
  item_name text not null,
  quantity numeric(9,2) not null,
  unit text,
  category_id uuid not null references public.categories(id),
  purchased_by uuid not null references public.profiles(id),
  purchased_at timestamptz not null default now()
);
create index purchase_history_family_time_idx on public.purchase_history(family_id, purchased_at desc);
create index purchase_history_name_idx on public.purchase_history(family_id, lower(item_name));

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('item_added', 'item_purchased', 'item_unpurchased', 'item_deleted', 'item_updated')),
  item_id uuid,
  item_name text not null,
  created_at timestamptz not null default now()
);
create index activity_logs_family_time_idx on public.activity_logs(family_id, created_at desc);

create table public.shopping_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index shopping_sessions_family_idx on public.shopping_sessions(family_id);

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'nl' check (language in ('nl', 'en', 'ar')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

insert into public.categories (name_nl, name_en, name_ar, emoji, sort_order) values
  ('Groenten en fruit', 'Fruit & vegetables', 'خضار وفواكه', '🥑', 1),
  ('Kruiden en specerijen', 'Herbs & spices', 'أعشاب وتوابل', '🌿', 2),
  ('Brood en bakkerij', 'Bakery', 'مخبوزات', '🥖', 3),
  ('Zuivel en eieren', 'Dairy & eggs', 'ألبان وبيض', '🥛', 4),
  ('Vlees en vis', 'Meat & fish', 'لحوم وأسماك', '🐟', 5),
  ('Dranken', 'Drinks', 'مشروبات', '🧃', 6),
  ('Diepvries', 'Frozen', 'مجمدات', '🧊', 7),
  ('Huishoudelijke producten', 'Household products', 'منتجات منزلية', '🧽', 8),
  ('Persoonlijke verzorging', 'Personal care', 'عناية شخصية', '🧴', 9),
  ('Overige', 'Other', 'أخرى', '🛒', 10)
on conflict (name_nl) do nothing;

create or replace function public.is_family_member(target_family uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = target_family and fm.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_family_member(uuid) from public;
grant execute on function public.is_family_member(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Family member'));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.record_item_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_name text;
  actor uuid;
begin
  if tg_op = 'INSERT' then
    action_name := 'item_added';
    actor := new.created_by;
  elsif tg_op = 'DELETE' then
    action_name := 'item_deleted';
    actor := (select auth.uid());
  elsif old.purchased_at is null and new.purchased_at is not null then
    action_name := 'item_purchased';
    actor := new.purchased_by;
    insert into public.purchase_history (family_id, item_id, item_name, quantity, unit, category_id, purchased_by, purchased_at)
    values (new.family_id, new.id, new.name, new.quantity, new.unit, new.category_id, new.purchased_by, new.purchased_at);
  elsif old.purchased_at is not null and new.purchased_at is null then
    action_name := 'item_unpurchased';
    actor := (select auth.uid());
    delete from public.purchase_history
    where item_id = old.id and purchased_at = old.purchased_at;
  else
    action_name := 'item_updated';
    actor := (select auth.uid());
  end if;

  if tg_op = 'DELETE' then
    insert into public.activity_logs (family_id, actor_id, action, item_id, item_name)
    values (old.family_id, actor, action_name, old.id, old.name);
    return old;
  end if;
  insert into public.activity_logs (family_id, actor_id, action, item_id, item_name)
  values (new.family_id, actor, action_name, new.id, new.name);
  return new;
end;
$$;
create trigger shopping_item_activity
  after insert or update or delete on public.shopping_items
  for each row execute procedure public.record_item_activity();

create or replace function public.guard_shopping_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.family_id <> old.family_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
      raise exception 'Item identity, family, creator, and creation time cannot be changed';
    end if;
    if old.purchased_at is null and new.purchased_at is not null then
      new.purchased_by := (select auth.uid());
      new.purchased_at := now();
    elsif old.purchased_at is not null and new.purchased_at is not null then
      new.purchased_at := old.purchased_at;
      new.purchased_by := old.purchased_by;
    elsif new.purchased_at is null then
      new.purchased_by := null;
    end if;
  end if;
  return new;
end;
$$;
create trigger shopping_item_guard
  before update on public.shopping_items
  for each row execute procedure public.guard_shopping_item();

create or replace function public.create_family_invite(p_family_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_code text;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'Not a member of this family' using errcode = '42501';
  end if;
  update public.family_invites
  set revoked_at = now()
  where family_id = p_family_id and revoked_at is null;
  invite_code := upper(substr(encode(extensions.gen_random_bytes(12), 'hex'), 1, 20));
  insert into public.family_invites (family_id, code_digest, created_by, expires_at)
  values (p_family_id, extensions.digest(invite_code, 'sha256'), (select auth.uid()), now() + interval '30 days');
  return invite_code;
end;
$$;
revoke all on function public.create_family_invite(uuid) from public;
grant execute on function public.create_family_invite(uuid) to authenticated;

create or replace function public.revoke_family_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.family_invites
  set revoked_at = now()
  where id = p_invite_id and public.is_family_member(family_id) and revoked_at is null;
  if not found then
    raise exception 'Invitation not found or already revoked' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.revoke_family_invite(uuid) from public;
grant execute on function public.revoke_family_invite(uuid) to authenticated;

create or replace function public.join_family_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.family_invites%rowtype;
begin
  if trim(p_code) !~ '^[A-Fa-f0-9]{20}$' then
    raise exception 'Invalid invitation code' using errcode = '22023';
  end if;
  select * into invite_row
  from public.family_invites fi
  where fi.code_digest = extensions.digest(upper(trim(p_code)), 'sha256')
    and fi.revoked_at is null
    and fi.expires_at > now()
  for update;
  if not found then
    raise exception 'Invitation code is invalid or expired' using errcode = '22023';
  end if;
  insert into public.family_members (family_id, user_id, role)
  values (invite_row.family_id, (select auth.uid()), 'member')
  on conflict (family_id, user_id) do nothing;
  update public.family_invites set uses = uses + 1 where id = invite_row.id;
  return invite_row.family_id;
end;
$$;
revoke all on function public.join_family_by_code(text) from public;
grant execute on function public.join_family_by_code(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.categories enable row level security;
alter table public.shopping_items enable row level security;
alter table public.purchase_history enable row level security;
alter table public.activity_logs enable row level security;
alter table public.shopping_sessions enable row level security;
alter table public.user_preferences enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, delete on public.family_members to authenticated;
grant select on public.categories to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;
grant select on public.purchase_history to authenticated;
grant select on public.activity_logs to authenticated;
grant select, insert, update, delete on public.shopping_sessions to authenticated;
grant select, insert, update on public.user_preferences to authenticated;

revoke all on public.family_invites from anon, authenticated;
grant select (id, family_id, created_by, expires_at, revoked_at, uses, created_at)
  on public.family_invites to authenticated;

create policy "Profiles are visible to self and family members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.family_members mine
    join public.family_members theirs on theirs.family_id = mine.family_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
  ));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Families visible to members" on public.families
  for select to authenticated using (
    public.is_family_member(id) or created_by = (select auth.uid())
  );
create policy "Authenticated users create families" on public.families
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Owners update family" on public.families
  for update to authenticated using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "Family creator deletes family" on public.families
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "Members can see their family roster" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));
create policy "Family creator can add self" on public.family_members
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.families f where f.id = family_id and f.created_by = (select auth.uid())
    )
  );
create policy "Owners can remove members" on public.family_members
  for delete to authenticated using (
    exists (select 1 from public.families f where f.id = family_id and f.created_by = (select auth.uid()))
    or user_id = (select auth.uid())
  );

create policy "Members can see invite metadata" on public.family_invites
  for select to authenticated using (public.is_family_member(family_id));
create policy "Categories are readable" on public.categories
  for select to authenticated using (true);

create policy "Family members read items" on public.shopping_items
  for select to authenticated using (public.is_family_member(family_id));
create policy "Family members add items" on public.shopping_items
  for insert to authenticated with check (
    created_by = (select auth.uid()) and public.is_family_member(family_id)
  );
create policy "Family members update items" on public.shopping_items
  for update to authenticated using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "Family members delete items" on public.shopping_items
  for delete to authenticated using (public.is_family_member(family_id));

create policy "Family members read purchase history" on public.purchase_history
  for select to authenticated using (public.is_family_member(family_id));
create policy "Family members read activity" on public.activity_logs
  for select to authenticated using (public.is_family_member(family_id));

create policy "Family members read shopping sessions" on public.shopping_sessions
  for select to authenticated using (public.is_family_member(family_id));
create policy "Users manage own shopping session" on public.shopping_sessions
  for all to authenticated using (user_id = (select auth.uid()) and public.is_family_member(family_id))
  with check (user_id = (select auth.uid()) and public.is_family_member(family_id));

create policy "Users manage own preferences" on public.user_preferences
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.shopping_sessions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.activity_logs;
exception when duplicate_object then null;
end $$;
