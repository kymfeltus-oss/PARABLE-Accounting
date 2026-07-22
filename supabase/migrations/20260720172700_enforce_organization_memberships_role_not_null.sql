-- Gate C: enforce NOT NULL on organization_memberships.role after explicit bootstrap.

do $$
begin
  if exists (
    select 1
    from public.organization_memberships
    where role is null
  ) then
    raise exception
      'organization_memberships.role must be assigned for every existing membership before Gate C enforcement';
  end if;
end $$;

alter table public.organization_memberships
  alter column role set not null;
