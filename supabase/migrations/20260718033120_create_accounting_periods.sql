create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounting_periods_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint accounting_periods_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint accounting_periods_date_range_valid
    check (start_date <= end_date),

  constraint accounting_periods_status_valid
    check (status in ('open', 'closed', 'locked')),

  constraint accounting_periods_organization_dates_key
    unique (organization_id, start_date, end_date)
);

alter table public.accounting_periods enable row level security;
