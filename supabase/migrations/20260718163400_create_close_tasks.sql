create table public.close_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  close_session_id uuid not null,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint close_tasks_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint close_tasks_close_session_id_fkey
    foreign key (close_session_id)
    references public.close_sessions(id)
    on delete cascade,

  constraint close_tasks_task_type_valid
    check (
      task_type in (
        'reconciliation',
        'transaction_review',
        'exception_review',
        'giving_review',
        'bill_review',
        'expense_review',
        'journal_review',
        'compliance_review',
        'fund_review',
        'accrual_review'
      )
    ),

  constraint close_tasks_status_valid
    check (
      status in (
        'pending',
        'in_progress',
        'completed',
        'skipped'
      )
    ),

  constraint close_tasks_completion_time_valid
    check (
      completed_at is null
      or status = 'completed'
    ),

  constraint close_tasks_sort_order_nonnegative
    check (
      sort_order >= 0
    )
);

alter table public.close_tasks enable row level security;
