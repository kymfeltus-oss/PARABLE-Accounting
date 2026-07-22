create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  accounting_period_id uuid not null,
  entry_number text not null,
  entry_date date not null,
  description text not null,
  source_type text not null default 'manual',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint journal_entries_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint journal_entries_accounting_period_id_fkey
    foreign key (accounting_period_id)
    references public.accounting_periods(id)
    on delete restrict,

  constraint journal_entries_entry_number_not_blank
    check (char_length(btrim(entry_number)) > 0),

  constraint journal_entries_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint journal_entries_source_type_valid
    check (
      source_type in (
        'manual',
        'giving',
        'banking',
        'expense',
        'bill',
        'adjustment',
        'closing'
      )
    ),

  constraint journal_entries_status_valid
    check (status in ('draft', 'posted', 'reversed')),

  constraint journal_entries_organization_number_key
    unique (organization_id, entry_number)
);

alter table public.journal_entries enable row level security;
