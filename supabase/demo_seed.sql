-- Run only in a dedicated demo Supabase project after creating and confirming
-- the demo@familycart.example user in Authentication.
do $$
declare
  demo_user uuid;
  demo_family uuid;
begin
  select id into demo_user
  from auth.users
  where email = 'demo@familycart.example'
  limit 1;

  if demo_user is null then
    raise exception 'Create and confirm demo@familycart.example in Supabase Auth first.';
  end if;

  select id into demo_family
  from public.families
  where name = 'FamilyCart Demo' and created_by = demo_user
  limit 1;

  if demo_family is null then
    insert into public.families (name, created_by)
    values ('FamilyCart Demo', demo_user)
    returning id into demo_family;
  end if;

  insert into public.family_members (family_id, user_id, role)
  values (demo_family, demo_user, 'owner')
  on conflict (family_id, user_id) do nothing;

  insert into public.shopping_items (family_id, name, quantity, unit, category_id, created_by)
  select demo_family, sample.name, sample.quantity, sample.unit, category.id, demo_user
  from (values
    ('Avocado', 2::numeric, 'stuks', 'Groenten en fruit'),
    ('Volkorenbrood', 1::numeric, 'heel', 'Brood en bakkerij'),
    ('Yoghurt', 1::numeric, 'bak', 'Zuivel en eieren'),
    ('Verse munt', 1::numeric, 'bosje', 'Kruiden en specerijen'),
    ('Afwasmiddel', 1::numeric, 'fles', 'Huishoudelijke producten')
  ) as sample(name, quantity, unit, category_name)
  join public.categories category on category.name_nl = sample.category_name
  where not exists (
    select 1 from public.shopping_items existing
    where existing.family_id = demo_family
      and lower(trim(existing.name)) = lower(trim(sample.name))
      and existing.purchased_at is null
  );
end;
$$;
