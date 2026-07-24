-- Master-data write paths: funds, members, accounts, accounting periods.

create or replace function public.create_fund(
  target_organization_id uuid,
  fund_name text,
  fund_code text default null,
  fund_type text default 'unrestricted'
)
returns public.funds
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_code text;
  normalized_type text;
  created_fund public.funds;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to create fund';
  end if;

  normalized_name := btrim(fund_name);
  normalized_code := nullif(btrim(fund_code), '');
  normalized_type := lower(btrim(coalesce(fund_type, 'unrestricted')));

  if normalized_name = '' then
    raise exception 'Fund name is required';
  end if;

  if normalized_type not in (
    'unrestricted',
    'temporarily_restricted',
    'permanently_restricted'
  ) then
    raise exception 'Fund type is invalid';
  end if;

  insert into public.funds (
    organization_id,
    name,
    code,
    fund_type,
    status
  )
  values (
    target_organization_id,
    normalized_name,
    normalized_code,
    normalized_type,
    'active'
  )
  returning *
  into created_fund;

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
    'fund.created',
    'fund',
    created_fund.id,
    'user',
    auth.uid(),
    format('Fund "%s" created', normalized_name),
    now()
  );

  return created_fund;
end;
$$;

revoke all on function public.create_fund(uuid, text, text, text) from public;
revoke execute on function public.create_fund(uuid, text, text, text) from anon;
grant execute on function public.create_fund(uuid, text, text, text) to authenticated;

create or replace function public.update_fund(
  target_organization_id uuid,
  target_fund_id uuid,
  fund_name text,
  fund_code text default null,
  fund_type text default 'unrestricted',
  fund_status text default 'active'
)
returns public.funds
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_code text;
  normalized_type text;
  normalized_status text;
  updated_fund public.funds;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_fund_id is null then
    raise exception 'Fund is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to update fund';
  end if;

  normalized_name := btrim(fund_name);
  normalized_code := nullif(btrim(fund_code), '');
  normalized_type := lower(btrim(coalesce(fund_type, 'unrestricted')));
  normalized_status := lower(btrim(coalesce(fund_status, 'active')));

  if normalized_name = '' then
    raise exception 'Fund name is required';
  end if;

  if normalized_type not in (
    'unrestricted',
    'temporarily_restricted',
    'permanently_restricted'
  ) then
    raise exception 'Fund type is invalid';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'Fund status is invalid';
  end if;

  update public.funds
  set
    name = normalized_name,
    code = normalized_code,
    fund_type = normalized_type,
    status = normalized_status,
    updated_at = now()
  where id = target_fund_id
    and organization_id = target_organization_id
  returning *
  into updated_fund;

  if updated_fund.id is null then
    raise exception 'Fund not found';
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
    'fund.updated',
    'fund',
    updated_fund.id,
    'user',
    auth.uid(),
    format('Fund "%s" updated', normalized_name),
    now()
  );

  return updated_fund;
end;
$$;

revoke all on function public.update_fund(uuid, uuid, text, text, text, text) from public;
revoke execute on function public.update_fund(uuid, uuid, text, text, text, text) from anon;
grant execute on function public.update_fund(uuid, uuid, text, text, text, text) to authenticated;

create or replace function public.create_member(
  target_organization_id uuid,
  member_first_name text,
  member_last_name text,
  member_email text default null,
  member_phone text default null
)
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_first_name text;
  normalized_last_name text;
  normalized_email text;
  normalized_phone text;
  created_member public.members;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to create member';
  end if;

  normalized_first_name := btrim(member_first_name);
  normalized_last_name := btrim(member_last_name);
  normalized_email := nullif(lower(btrim(member_email)), '');
  normalized_phone := nullif(btrim(member_phone), '');

  if normalized_first_name = '' then
    raise exception 'Member first name is required';
  end if;

  if normalized_last_name = '' then
    raise exception 'Member last name is required';
  end if;

  insert into public.members (
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    status
  )
  values (
    target_organization_id,
    normalized_first_name,
    normalized_last_name,
    normalized_email,
    normalized_phone,
    'active'
  )
  returning *
  into created_member;

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
    'member.created',
    'member',
    created_member.id,
    'user',
    auth.uid(),
    format('Member "%s %s" created', normalized_first_name, normalized_last_name),
    now()
  );

  return created_member;
end;
$$;

revoke all on function public.create_member(uuid, text, text, text, text) from public;
revoke execute on function public.create_member(uuid, text, text, text, text) from anon;
grant execute on function public.create_member(uuid, text, text, text, text) to authenticated;

create or replace function public.update_member(
  target_organization_id uuid,
  target_member_id uuid,
  member_first_name text,
  member_last_name text,
  member_email text default null,
  member_phone text default null,
  member_status text default 'active'
)
returns public.members
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_first_name text;
  normalized_last_name text;
  normalized_email text;
  normalized_phone text;
  normalized_status text;
  updated_member public.members;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_member_id is null then
    raise exception 'Member is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to update member';
  end if;

  normalized_first_name := btrim(member_first_name);
  normalized_last_name := btrim(member_last_name);
  normalized_email := nullif(lower(btrim(member_email)), '');
  normalized_phone := nullif(btrim(member_phone), '');
  normalized_status := lower(btrim(coalesce(member_status, 'active')));

  if normalized_first_name = '' then
    raise exception 'Member first name is required';
  end if;

  if normalized_last_name = '' then
    raise exception 'Member last name is required';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'Member status is invalid';
  end if;

  update public.members
  set
    first_name = normalized_first_name,
    last_name = normalized_last_name,
    email = normalized_email,
    phone = normalized_phone,
    status = normalized_status,
    updated_at = now()
  where id = target_member_id
    and organization_id = target_organization_id
  returning *
  into updated_member;

  if updated_member.id is null then
    raise exception 'Member not found';
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
    'member.updated',
    'member',
    updated_member.id,
    'user',
    auth.uid(),
    format('Member "%s %s" updated', normalized_first_name, normalized_last_name),
    now()
  );

  return updated_member;
end;
$$;

revoke all on function public.update_member(uuid, uuid, text, text, text, text, text) from public;
revoke execute on function public.update_member(uuid, uuid, text, text, text, text, text) from anon;
grant execute on function public.update_member(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.create_account(
  target_organization_id uuid,
  account_code text,
  account_name text,
  account_type text,
  is_posting boolean default true
)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text;
  normalized_name text;
  normalized_type text;
  created_account public.accounts;
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
    raise exception 'Insufficient role to create account';
  end if;

  normalized_code := btrim(account_code);
  normalized_name := btrim(account_name);
  normalized_type := lower(btrim(account_type));

  if normalized_code = '' then
    raise exception 'Account code is required';
  end if;

  if normalized_name = '' then
    raise exception 'Account name is required';
  end if;

  if normalized_type not in (
    'asset',
    'liability',
    'net_asset',
    'revenue',
    'expense'
  ) then
    raise exception 'Account type is invalid';
  end if;

  insert into public.accounts (
    organization_id,
    code,
    name,
    account_type,
    is_posting,
    status
  )
  values (
    target_organization_id,
    normalized_code,
    normalized_name,
    normalized_type,
    coalesce(is_posting, true),
    'active'
  )
  returning *
  into created_account;

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
    'account.created',
    'account',
    created_account.id,
    'user',
    auth.uid(),
    format('Account %s "%s" created', normalized_code, normalized_name),
    now()
  );

  return created_account;
end;
$$;

revoke all on function public.create_account(uuid, text, text, text, boolean) from public;
revoke execute on function public.create_account(uuid, text, text, text, boolean) from anon;
grant execute on function public.create_account(uuid, text, text, text, boolean) to authenticated;

create or replace function public.update_account(
  target_organization_id uuid,
  target_account_id uuid,
  account_code text,
  account_name text,
  account_type text,
  is_posting boolean default true,
  account_status text default 'active'
)
returns public.accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text;
  normalized_name text;
  normalized_type text;
  normalized_status text;
  updated_account public.accounts;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_account_id is null then
    raise exception 'Account is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant']
  ) then
    raise exception 'Insufficient role to update account';
  end if;

  normalized_code := btrim(account_code);
  normalized_name := btrim(account_name);
  normalized_type := lower(btrim(account_type));
  normalized_status := lower(btrim(coalesce(account_status, 'active')));

  if normalized_code = '' then
    raise exception 'Account code is required';
  end if;

  if normalized_name = '' then
    raise exception 'Account name is required';
  end if;

  if normalized_type not in (
    'asset',
    'liability',
    'net_asset',
    'revenue',
    'expense'
  ) then
    raise exception 'Account type is invalid';
  end if;

  if normalized_status not in ('active', 'inactive') then
    raise exception 'Account status is invalid';
  end if;

  update public.accounts
  set
    code = normalized_code,
    name = normalized_name,
    account_type = normalized_type,
    is_posting = coalesce(is_posting, true),
    status = normalized_status,
    updated_at = now()
  where id = target_account_id
    and organization_id = target_organization_id
  returning *
  into updated_account;

  if updated_account.id is null then
    raise exception 'Account not found';
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
    'account.updated',
    'account',
    updated_account.id,
    'user',
    auth.uid(),
    format('Account %s "%s" updated', normalized_code, normalized_name),
    now()
  );

  return updated_account;
end;
$$;

revoke all on function public.update_account(uuid, uuid, text, text, text, boolean, text) from public;
revoke execute on function public.update_account(uuid, uuid, text, text, text, boolean, text) from anon;
grant execute on function public.update_account(uuid, uuid, text, text, text, boolean, text) to authenticated;

create or replace function public.create_accounting_period(
  target_organization_id uuid,
  period_name text,
  period_start_date date,
  period_end_date date
)
returns public.accounting_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  created_period public.accounting_periods;
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
    raise exception 'Insufficient role to create accounting period';
  end if;

  normalized_name := btrim(period_name);

  if normalized_name = '' then
    raise exception 'Accounting period name is required';
  end if;

  if period_start_date is null or period_end_date is null then
    raise exception 'Accounting period dates are required';
  end if;

  if period_start_date > period_end_date then
    raise exception 'Accounting period start date must be on or before end date';
  end if;

  insert into public.accounting_periods (
    organization_id,
    name,
    start_date,
    end_date,
    status
  )
  values (
    target_organization_id,
    normalized_name,
    period_start_date,
    period_end_date,
    'open'
  )
  returning *
  into created_period;

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
    'accounting_period.created',
    'accounting_period',
    created_period.id,
    'user',
    auth.uid(),
    format('Accounting period "%s" created', normalized_name),
    now()
  );

  return created_period;
end;
$$;

revoke all on function public.create_accounting_period(uuid, text, date, date) from public;
revoke execute on function public.create_accounting_period(uuid, text, date, date) from anon;
grant execute on function public.create_accounting_period(uuid, text, date, date) to authenticated;

create or replace function public.close_accounting_period(
  target_organization_id uuid,
  target_period_id uuid
)
returns public.accounting_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_period public.accounting_periods;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_period_id is null then
    raise exception 'Accounting period is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant']
  ) then
    raise exception 'Insufficient role to close accounting period';
  end if;

  select period.*
  into updated_period
  from public.accounting_periods period
  where period.id = target_period_id
    and period.organization_id = target_organization_id
  for update;

  if updated_period.id is null then
    raise exception 'Accounting period not found';
  end if;

  if updated_period.status <> 'open' then
    raise exception 'Only open accounting periods can be closed';
  end if;

  update public.accounting_periods
  set
    status = 'closed',
    updated_at = now()
  where id = updated_period.id
  returning *
  into updated_period;

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
    'accounting_period.closed',
    'accounting_period',
    updated_period.id,
    'user',
    auth.uid(),
    format('Accounting period "%s" closed', updated_period.name),
    now()
  );

  return updated_period;
end;
$$;

revoke all on function public.close_accounting_period(uuid, uuid) from public;
revoke execute on function public.close_accounting_period(uuid, uuid) from anon;
grant execute on function public.close_accounting_period(uuid, uuid) to authenticated;
