-- Self-serve organization bootstrap with starter chart, fund, period, and bank account.

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_slug text;
  created_organization public.organizations;
  cash_account_id uuid;
  revenue_account_id uuid;
  period_start date;
  period_end date;
  period_name text;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  normalized_name := btrim(organization_name);
  normalized_slug := lower(btrim(organization_slug));

  if normalized_name = '' then
    raise exception 'Organization name is required';
  end if;

  if normalized_slug = '' then
    raise exception 'Organization slug is required';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organization slug format is invalid';
  end if;

  if exists (
    select 1
    from public.organizations existing_organization
    where existing_organization.slug = normalized_slug
  ) then
    raise exception 'Organization slug is already in use';
  end if;

  insert into public.organizations (
    name,
    slug,
    status
  )
  values (
    normalized_name,
    normalized_slug,
    'active'
  )
  returning *
  into created_organization;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role
  )
  values (
    created_organization.id,
    auth.uid(),
    'owner'
  );

  insert into public.organization_settings (
    organization_id,
    fiscal_year_start_month
  )
  values (
    created_organization.id,
    1
  );

  insert into public.accounts (
    organization_id,
    code,
    name,
    account_type,
    is_posting,
    status
  )
  values
    (created_organization.id, '1000', 'Operating Checking', 'asset', true, 'active'),
    (created_organization.id, '2000', 'Accounts Payable', 'liability', true, 'active'),
    (created_organization.id, '2100', 'Credit Cards Payable', 'liability', true, 'active'),
    (created_organization.id, '3000', 'Unrestricted Net Assets', 'net_asset', true, 'active'),
    (created_organization.id, '4000', 'Contributions Income', 'revenue', true, 'active'),
    (created_organization.id, '5000', 'Ministry Expenses', 'expense', true, 'active'),
    (created_organization.id, '6000', 'Administrative Expenses', 'expense', true, 'active');

  select account.id
  into cash_account_id
  from public.accounts account
  where account.organization_id = created_organization.id
    and account.code = '1000';

  select account.id
  into revenue_account_id
  from public.accounts account
  where account.organization_id = created_organization.id
    and account.code = '4000';

  update public.organization_settings
  set
    default_cash_account_id = cash_account_id,
    default_revenue_account_id = revenue_account_id,
    updated_at = now()
  where organization_id = created_organization.id;

  insert into public.funds (
    organization_id,
    name,
    code,
    fund_type,
    status
  )
  values (
    created_organization.id,
    'General Fund',
    'GF',
    'unrestricted',
    'active'
  );

  period_start := date_trunc('month', timezone('utc', now()))::date;
  period_end := (period_start + interval '1 month' - interval '1 day')::date;
  period_name := to_char(period_start, 'FMMonth YYYY');

  insert into public.accounting_periods (
    organization_id,
    name,
    start_date,
    end_date,
    status
  )
  values (
    created_organization.id,
    period_name,
    period_start,
    period_end,
    'open'
  );

  insert into public.bank_accounts (
    organization_id,
    account_id,
    name,
    institution_name,
    account_type,
    status
  )
  values (
    created_organization.id,
    cash_account_id,
    'Operating Checking',
    null,
    'checking',
    'active'
  );

  insert into public.audit_events (
    organization_id,
    event_type,
    source_type,
    source_id,
    actor_type,
    actor_user_id,
    description,
    occurred_at
  )
  values (
    created_organization.id,
    'organization.created',
    'organization',
    created_organization.id,
    'user',
    auth.uid(),
    format('Organization "%s" created with starter chart, fund, period, and bank account', normalized_name),
    now()
  );

  return created_organization;
end;
$$;

comment on function public.create_organization(text, text) is
  'Creates an organization for the authenticated caller as owner, seeds starter accounts/fund/period/bank account/settings, and appends organization.created audit. SECURITY DEFINER is the sole authenticated bootstrap write path.';

revoke all on function public.create_organization(text, text) from public;
revoke execute on function public.create_organization(text, text) from anon;
grant execute on function public.create_organization(text, text) to authenticated;
