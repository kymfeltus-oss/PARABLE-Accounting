alter table public.organization_memberships
  add column role text;

alter table public.organization_memberships
  add constraint organization_memberships_role_valid
  check (
    role is null
    or role in (
      'owner',
      'accountant',
      'staff',
      'viewer'
    )
  );

comment on column public.organization_memberships.role is
  'Organization-scoped authorization role for authenticated users. Must be set explicitly; no default.';
