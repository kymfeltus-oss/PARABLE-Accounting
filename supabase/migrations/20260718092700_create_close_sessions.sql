create table public.close_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  accounting_period_id uuid not null,
  close_type text not null default 'month_end',
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint close_sessions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint close_sessions_accounting_period_id_fkey
    foreign key (accounting_period_id)
    references public.accounting_periods(id)
    on delete restrict,

  constraint close_sessions_close_type_valid
    check (
      close_type in (
        'month_end',
        'quarter_end',
        'year_end'
      )
    ),

  constraint close_sessions_status_valid
    check (
      status in (
        'draft',
        'in_progress',
        'completed'
      )
    ),

  constraint close_sessions_completion_time_valid
    check (
      completed_at is null
      or started_at is not null
    )
);

alter table public.close_sessions enable row level security;
