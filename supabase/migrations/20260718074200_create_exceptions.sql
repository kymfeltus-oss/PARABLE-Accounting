create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_type text not null,
  source_id uuid,
  category text not null default 'other',
  severity text not null default 'medium',
  title text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exceptions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint exceptions_source_type_not_blank
    check (char_length(btrim(source_type)) > 0),

  constraint exceptions_category_valid
    check (
      category in (
        'accounting',
        'banking',
        'bills',
        'expenses',
        'giving',
        'budgets',
        'compliance',
        'data_quality',
        'other'
      )
    ),

  constraint exceptions_severity_valid
    check (
      severity in (
        'low',
        'medium',
        'high',
        'critical'
      )
    ),

  constraint exceptions_title_not_blank
    check (char_length(btrim(title)) > 0),

  constraint exceptions_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint exceptions_status_valid
    check (
      status in (
        'open',
        'resolved',
        'dismissed'
      )
    )
);

alter table public.exceptions enable row level security;
