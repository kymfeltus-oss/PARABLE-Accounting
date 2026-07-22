create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budgets_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint budgets_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint budgets_date_range_valid
    check (end_date >= start_date),

  constraint budgets_status_valid
    check (
      status in (
        'draft',
        'active',
        'closed'
      )
    )
);

alter table public.budgets enable row level security;
