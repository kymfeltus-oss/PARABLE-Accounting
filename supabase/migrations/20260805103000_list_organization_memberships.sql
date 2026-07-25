-- List organization memberships with auth user emails for Settings team UI.

create or replace function public.list_organization_memberships(
  target_organization_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  user_id uuid,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff', 'viewer']
  ) then
    raise exception 'Insufficient role to list organization memberships';
  end if;

  return query
  select
    membership.id,
    membership.organization_id,
    membership.user_id,
    membership.role,
    membership.created_at,
    membership.updated_at,
    auth_user.email::text
  from public.organization_memberships as membership
  left join auth.users as auth_user
    on auth_user.id = membership.user_id
  where membership.organization_id = target_organization_id
  order by membership.created_at desc;
end;
$$;

comment on function public.list_organization_memberships(uuid) is
  'Returns organization memberships with auth user email for authenticated org members. SECURITY DEFINER is required to read auth.users emails without exposing admin client access in the app layer.';

revoke all on function public.list_organization_memberships(uuid) from public;
revoke execute on function public.list_organization_memberships(uuid) from anon;
grant execute on function public.list_organization_memberships(uuid) to authenticated;
