create table public.funds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  code text,
  fund_type text not null default 'unrestricted',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint funds_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint funds_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint funds_code_not_blank
    check (code is null or char_length(btrim(code)) > 0),

  constraint funds_type_valid
    check (fund_type in ('unrestricted', 'temporarily_restricted', 'permanently_restricted')),

  constraint funds_status_valid
    check (status in ('active', 'inactive')),

  constraint funds_organization_name_key
    unique (organization_id, name),

  constraint funds_organization_code_key
    unique (organization_id, code)
);

alter table public.funds enable row level security;
