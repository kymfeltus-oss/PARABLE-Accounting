create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  category text not null default 'other',
  due_date date,
  status text not null default 'open',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint compliance_items_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint compliance_items_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint compliance_items_category_valid
    check (
      category in (
        'federal_tax',
        'state_tax',
        'payroll',
        'charity_registration',
        'governance',
        'policy',
        'other'
      )
    ),

  constraint compliance_items_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint compliance_items_status_valid
    check (
      status in (
        'open',
        'completed',
        'not_applicable'
      )
    )
);

alter table public.compliance_items enable row level security;
