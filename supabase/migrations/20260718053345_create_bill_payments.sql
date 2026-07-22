create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bill_id uuid not null,
  payment_date date not null,
  amount numeric(18,2) not null,
  reference text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bill_payments_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bill_payments_bill_id_fkey
    foreign key (bill_id)
    references public.bills(id)
    on delete restrict,

  constraint bill_payments_amount_positive
    check (amount > 0),

  constraint bill_payments_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint bill_payments_status_valid
    check (
      status in (
        'recorded',
        'void'
      )
    )
);

alter table public.bill_payments enable row level security;
