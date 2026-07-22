-- Role-aware read helpers and owner membership visibility for organization_memberships.

create or replace function public.current_membership_role(
  target_organization_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.organization_memberships membership
  where membership.organization_id = target_organization_id
    and membership.user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_membership_role(uuid) is
  'Returns the authenticated user role for target_organization_id, or NULL when no membership exists. SECURITY DEFINER bypasses organization_memberships RLS.';

revoke all on function public.current_membership_role(uuid) from public;
revoke execute on function public.current_membership_role(uuid) from anon;
grant execute on function public.current_membership_role(uuid) to authenticated;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_membership_role(target_organization_id) = any (allowed_roles);
$$;

comment on function public.has_org_role(uuid, text[]) is
  'Returns true when auth.uid() has one of allowed_roles in target_organization_id. SECURITY DEFINER bypasses organization_memberships RLS.';

revoke all on function public.has_org_role(uuid, text[]) from public;
revoke execute on function public.has_org_role(uuid, text[]) from anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

drop policy organization_memberships_select_self on public.organization_memberships;

create policy organization_memberships_select_self
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_role(organization_id, array['owner'])
  );
