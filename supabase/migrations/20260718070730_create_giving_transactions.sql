create table public.giving_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid,
  fund_id uuid,
  transaction_date date not null,
  amount numeric(18,2) not null,
  giving_method text not null default 'other',
  reference text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint giving_transactions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint giving_transactions_member_id_fkey
    foreign key (member_id)
    references public.members(id)
    on delete set null,

  constraint giving_transactions_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint giving_transactions_amount_positive
    check (amount > 0),

  constraint giving_transactions_method_valid
    check (
      giving_method in (
        'cash',
        'check',
        'card',
        'ach',
        'other'
      )
    ),

  constraint giving_transactions_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint giving_transactions_status_valid
    check (
      status in (
        'recorded',
        'void'
      )
    )
);

alter table public.giving_transactions enable row level security;
