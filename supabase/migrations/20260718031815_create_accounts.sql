create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  parent_account_id uuid,
  code text not null,
  name text not null,
  account_type text not null,
  is_posting boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint accounts_parent_account_id_fkey
    foreign key (parent_account_id)
    references public.accounts(id)
    on delete restrict,

  constraint accounts_code_not_blank
    check (char_length(btrim(code)) > 0),

  constraint accounts_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint accounts_type_valid
    check (
      account_type in (
        'asset',
        'liability',
        'net_asset',
        'revenue',
        'expense'
      )
    ),

  constraint accounts_status_valid
    check (status in ('active', 'inactive')),

  constraint accounts_organization_code_key
    unique (organization_id, code)
);

alter table public.accounts enable row level security;
