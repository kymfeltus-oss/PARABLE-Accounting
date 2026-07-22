create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id uuid,
  expense_date date not null,
  description text not null,
  total_amount numeric(18,2) not null,
  reference text,
  payment_source text not null default 'other',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenses_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint expenses_vendor_id_fkey
    foreign key (vendor_id)
    references public.vendors(id)
    on delete restrict,

  constraint expenses_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint expenses_total_amount_positive
    check (total_amount > 0),

  constraint expenses_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint expenses_payment_source_valid
    check (
      payment_source in (
        'bank',
        'card',
        'cash',
        'reimbursement',
        'other'
      )
    ),

  constraint expenses_status_valid
    check (
      status in (
        'draft',
        'recorded',
        'void'
      )
    )
);

alter table public.expenses enable row level security;
