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

alter policy "Families visible to members" on public.families
  using (public.is_family_member(id) or created_by = (select auth.uid()));
