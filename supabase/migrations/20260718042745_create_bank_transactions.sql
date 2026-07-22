create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null,
  transaction_date date not null,
  posted_date date,
  description text not null,
  amount numeric(18,2) not null,
  reference text,
  source_type text not null default 'manual',
  external_id text,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_transactions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_transactions_bank_account_id_fkey
    foreign key (bank_account_id)
    references public.bank_accounts(id)
    on delete cascade,

  constraint bank_transactions_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint bank_transactions_amount_nonzero
    check (amount <> 0),

  constraint bank_transactions_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint bank_transactions_source_type_valid
    check (
      source_type in (
        'manual',
        'import',
        'bank_feed'
      )
    ),

  constraint bank_transactions_external_id_not_blank
    check (
      external_id is null
      or char_length(btrim(external_id)) > 0
    ),

  constraint bank_transactions_status_valid
    check (
      status in (
        'unmatched',
        'matched',
        'excluded'
      )
    ),

  constraint bank_transactions_bank_external_key
    unique (bank_account_id, external_id)
);

alter table public.bank_transactions enable row level security;
