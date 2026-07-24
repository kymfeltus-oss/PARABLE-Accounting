-- Organization profile and accounting defaults updates.

create or replace function public.update_organization_profile(
  target_organization_id uuid,
  organization_name text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  updated_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(target_organization_id, array['owner']) then
    raise exception 'Insufficient role to update organization profile';
  end if;

  normalized_name := btrim(organization_name);

  if normalized_name = '' then
    raise exception 'Organization name is required';
  end if;

  update public.organizations
  set
    name = normalized_name,
    updated_at = now()
  where id = target_organization_id
  returning *
  into updated_organization;

  if updated_organization.id is null then
    raise exception 'Organization not found';
  end if;

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
    target_organization_id,
    'organization.profile_updated',
    'organization',
    target_organization_id,
    'user',
    auth.uid(),
    format('Organization profile updated to "%s"', normalized_name),
    now()
  );

  return updated_organization;
end;
$$;

comment on function public.update_organization_profile(uuid, text) is
  'Owner-only organization display name update.';

revoke all on function public.update_organization_profile(uuid, text) from public;
revoke execute on function public.update_organization_profile(uuid, text) from anon;
grant execute on function public.update_organization_profile(uuid, text) to authenticated;

create or replace function public.update_organization_settings(
  target_organization_id uuid,
  fiscal_year_start_month integer,
  default_cash_account_id uuid default null,
  default_revenue_account_id uuid default null
)
returns public.organization_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_settings public.organization_settings;
  cash_account public.accounts;
  revenue_account public.accounts;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant']
  ) then
    raise exception 'Insufficient role to update organization settings';
  end if;

  if fiscal_year_start_month is null
    or fiscal_year_start_month < 1
    or fiscal_year_start_month > 12 then
    raise exception 'Fiscal year start month is invalid';
  end if;

  if default_cash_account_id is not null then
    select account.*
    into cash_account
    from public.accounts account
    where account.id = default_cash_account_id
      and account.organization_id = target_organization_id;

    if cash_account.id is null then
      raise exception 'Default cash account not found';
    end if;

    if cash_account.status <> 'active'
      or cash_account.is_posting is not true
      or cash_account.account_type <> 'asset' then
      raise exception 'Default cash account must be an active posting asset account';
    end if;
  end if;

  if default_revenue_account_id is not null then
    select account.*
    into revenue_account
    from public.accounts account
    where account.id = default_revenue_account_id
      and account.organization_id = target_organization_id;

    if revenue_account.id is null then
      raise exception 'Default revenue account not found';
    end if;

    if revenue_account.status <> 'active'
      or revenue_account.is_posting is not true
      or revenue_account.account_type <> 'revenue' then
      raise exception 'Default revenue account must be an active posting revenue account';
    end if;
  end if;

  update public.organization_settings
  set
    fiscal_year_start_month = fiscal_year_start_month,
    default_cash_account_id = default_cash_account_id,
    default_revenue_account_id = default_revenue_account_id,
    updated_at = now()
  where organization_id = target_organization_id
  returning *
  into updated_settings;

  if updated_settings.organization_id is null then
    insert into public.organization_settings (
      organization_id,
      fiscal_year_start_month,
      default_cash_account_id,
      default_revenue_account_id
    )
    values (
      target_organization_id,
      fiscal_year_start_month,
      default_cash_account_id,
      default_revenue_account_id
    )
    returning *
    into updated_settings;
  end if;

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
    target_organization_id,
    'organization.settings_updated',
    'organization_settings',
    target_organization_id,
    'user',
    auth.uid(),
    'Organization accounting defaults updated',
    now()
  );

  return updated_settings;
end;
$$;

comment on function public.update_organization_settings(uuid, integer, uuid, uuid) is
  'Owner/accountant update for fiscal year start and default posting accounts.';

revoke all on function public.update_organization_settings(uuid, integer, uuid, uuid) from public;
revoke execute on function public.update_organization_settings(uuid, integer, uuid, uuid) from anon;
grant execute on function public.update_organization_settings(uuid, integer, uuid, uuid) to authenticated;
