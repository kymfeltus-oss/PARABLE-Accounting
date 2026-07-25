-- Fix update_organization_settings parameter/column name collisions.
-- INSERT/UPDATE used unqualified names that matched column names, so
-- orgs without an organization_settings row could not create one.

drop function if exists public.update_organization_settings(uuid, integer, uuid, uuid);

create or replace function public.update_organization_settings(
  target_organization_id uuid,
  p_fiscal_year_start_month integer,
  p_default_cash_account_id uuid default null,
  p_default_revenue_account_id uuid default null
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

  if p_fiscal_year_start_month is null
    or p_fiscal_year_start_month < 1
    or p_fiscal_year_start_month > 12 then
    raise exception 'Fiscal year start month is invalid';
  end if;

  if p_default_cash_account_id is not null then
    select account.*
    into cash_account
    from public.accounts account
    where account.id = p_default_cash_account_id
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

  if p_default_revenue_account_id is not null then
    select account.*
    into revenue_account
    from public.accounts account
    where account.id = p_default_revenue_account_id
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
    fiscal_year_start_month = p_fiscal_year_start_month,
    default_cash_account_id = p_default_cash_account_id,
    default_revenue_account_id = p_default_revenue_account_id,
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
      p_fiscal_year_start_month,
      p_default_cash_account_id,
      p_default_revenue_account_id
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

-- Backfill missing settings rows for orgs created before settings seeding.
insert into public.organization_settings (organization_id, fiscal_year_start_month)
select o.id, 1
from public.organizations o
where not exists (
  select 1
  from public.organization_settings s
  where s.organization_id = o.id
);
