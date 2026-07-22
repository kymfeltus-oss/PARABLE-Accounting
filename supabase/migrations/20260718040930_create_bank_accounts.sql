create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  account_id uuid not null,
  name text not null,
  institution_name text,
  account_type text not null default 'checking',
  last_four text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_accounts_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_accounts_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint bank_accounts_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint bank_accounts_institution_name_not_blank
    check (
      institution_name is null
      or char_length(btrim(institution_name)) > 0
    ),

  constraint bank_accounts_type_valid
    check (
      account_type in (
        'checking',
        'savings',
        'money_market'
      )
    ),

  constraint bank_accounts_last_four_valid
    check (
      last_four is null
      or last_four ~ '^[0-9]{4}$'
    ),

  constraint bank_accounts_status_valid
    check (status in ('active', 'inactive')),

  constraint bank_accounts_organization_name_key
    unique (organization_id, name)
);

alter table public.bank_accounts enable row level security;
