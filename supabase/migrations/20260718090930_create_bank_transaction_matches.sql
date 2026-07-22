create table public.bank_transaction_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_transaction_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  matched_amount numeric(18,2) not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_transaction_matches_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_transaction_matches_bank_transaction_id_fkey
    foreign key (bank_transaction_id)
    references public.bank_transactions(id)
    on delete cascade,

  constraint bank_transaction_matches_source_type_valid
    check (
      source_type in (
        'bill_payment',
        'expense',
        'giving_transaction',
        'journal_entry'
      )
    ),

  constraint bank_transaction_matches_amount_positive
    check (matched_amount > 0),

  constraint bank_transaction_matches_source_unique
    unique (
      bank_transaction_id,
      source_type,
      source_id
    ),

  constraint bank_transaction_matches_status_valid
    check (
      status in (
        'proposed',
        'confirmed',
        'rejected'
      )
    )
);

alter table public.bank_transaction_matches enable row level security;
