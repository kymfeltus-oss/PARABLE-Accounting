create table public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  bank_transaction_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliation_items_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint reconciliation_items_reconciliation_id_fkey
    foreign key (reconciliation_id)
    references public.reconciliations(id)
    on delete cascade,

  constraint reconciliation_items_bank_transaction_id_fkey
    foreign key (bank_transaction_id)
    references public.bank_transactions(id)
    on delete restrict,

  constraint reconciliation_items_reconciliation_transaction_unique
    unique (reconciliation_id, bank_transaction_id),

  constraint reconciliation_items_status_valid
    check (
      status in (
        'pending',
        'cleared',
        'excluded'
      )
    )
);

alter table public.reconciliation_items enable row level security;
