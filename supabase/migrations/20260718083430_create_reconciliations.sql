create table public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  statement_ending_balance numeric(18,2) not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliations_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint reconciliations_bank_account_id_fkey
    foreign key (bank_account_id)
    references public.bank_accounts(id)
    on delete restrict,

  constraint reconciliations_period_valid
    check (period_end >= period_start),

  constraint reconciliations_status_valid
    check (
      status in (
        'draft',
        'in_progress',
        'completed'
      )
    )
);

alter table public.reconciliations enable row level security;
