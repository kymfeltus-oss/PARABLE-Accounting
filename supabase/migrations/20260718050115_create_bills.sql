create table public.bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id uuid not null,
  bill_number text,
  bill_date date not null,
  due_date date,
  description text,
  total_amount numeric(18,2) not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bills_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bills_vendor_id_fkey
    foreign key (vendor_id)
    references public.vendors(id)
    on delete restrict,

  constraint bills_bill_number_not_blank
    check (
      bill_number is null
      or char_length(btrim(bill_number)) > 0
    ),

  constraint bills_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint bills_total_amount_positive
    check (total_amount > 0),

  constraint bills_status_valid
    check (
      status in (
        'draft',
        'open',
        'paid',
        'void'
      )
    ),

  constraint bills_vendor_number_key
    unique (vendor_id, bill_number)
);

alter table public.bills enable row level security;
