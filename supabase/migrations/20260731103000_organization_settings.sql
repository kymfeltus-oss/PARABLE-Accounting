-- Persisted organization settings for accounting defaults.

create table public.organization_settings (
  organization_id uuid primary key,
  fiscal_year_start_month integer not null default 1,
  default_cash_account_id uuid,
  default_revenue_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_settings_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint organization_settings_default_cash_account_id_fkey
    foreign key (default_cash_account_id)
    references public.accounts(id)
    on delete set null,

  constraint organization_settings_default_revenue_account_id_fkey
    foreign key (default_revenue_account_id)
    references public.accounts(id)
    on delete set null,

  constraint organization_settings_fiscal_year_start_month_valid
    check (
      fiscal_year_start_month >= 1
      and fiscal_year_start_month <= 12
    )
);

alter table public.organization_settings enable row level security;

create policy organization_settings_select_member
  on public.organization_settings
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

comment on table public.organization_settings is
  'Organization-scoped accounting defaults. Authenticated writes go through SECURITY DEFINER RPCs only.';
