create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_memberships_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint organization_memberships_organization_user_key
    unique (organization_id, user_id)
);

alter table public.organization_memberships enable row level security;
