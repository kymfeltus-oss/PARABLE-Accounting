-- Budget write paths: create budget, upsert budget line, and activate budget.

create or replace function public.create_budget(
  target_organization_id uuid,
  budget_name text,
  budget_start_date date,
  budget_end_date date,
  budget_status text default 'draft'
)
returns public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_status text;
  created_budget public.budgets;
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
    raise exception 'Insufficient role to create budget';
  end if;

  normalized_name := btrim(budget_name);
  normalized_status := lower(btrim(coalesce(budget_status, 'draft')));

  if normalized_name = '' then
    raise exception 'Budget name is required';
  end if;

  if budget_start_date is null or budget_end_date is null then
    raise exception 'Budget dates are required';
  end if;

  if budget_start_date > budget_end_date then
    raise exception 'Budget start date must be on or before end date';
  end if;

  if normalized_status not in ('draft', 'active') then
    raise exception 'Budget status must be draft or active';
  end if;

  insert into public.budgets (
    organization_id,
    name,
    start_date,
    end_date,
    status
  )
  values (
    target_organization_id,
    normalized_name,
    budget_start_date,
    budget_end_date,
    normalized_status
  )
  returning *
  into created_budget;

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
    'budget.created',
    'budget',
    created_budget.id,
    'user',
    auth.uid(),
    format('Budget "%s" created', normalized_name),
    now()
  );

  return created_budget;
end;
$$;

revoke all on function public.create_budget(uuid, text, date, date, text) from public;
revoke execute on function public.create_budget(uuid, text, date, date, text) from anon;
grant execute on function public.create_budget(uuid, text, date, date, text) to authenticated;

create or replace function public.upsert_budget_line(
  target_organization_id uuid,
  target_budget_id uuid,
  target_account_id uuid,
  line_amount numeric,
  target_fund_id uuid default null
)
returns public.budget_lines
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_budget public.budgets;
  matched_account public.accounts;
  matched_fund public.funds;
  existing_line public.budget_lines;
  next_line_number integer;
  upserted_line public.budget_lines;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_budget_id is null then
    raise exception 'Budget is required';
  end if;

  if target_account_id is null then
    raise exception 'Account is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to upsert budget line';
  end if;

  if line_amount is null or line_amount < 0 then
    raise exception 'Budget line amount must be zero or greater';
  end if;

  select *
  into matched_budget
  from public.budgets
  where id = target_budget_id;

  if not found then
    raise exception 'Budget not found';
  end if;

  if matched_budget.organization_id <> target_organization_id then
    raise exception 'Budget does not belong to organization';
  end if;

  if matched_budget.status = 'closed' then
    raise exception 'Closed budgets cannot be edited';
  end if;

  select *
  into matched_account
  from public.accounts
  where id = target_account_id;

  if not found then
    raise exception 'Account not found';
  end if;

  if matched_account.organization_id <> target_organization_id then
    raise exception 'Account does not belong to organization';
  end if;

  if matched_account.status <> 'active' then
    raise exception 'Account must be active';
  end if;

  if matched_account.account_type not in ('expense', 'revenue') then
    raise exception 'Budget lines must use expense or revenue accounts';
  end if;

  if target_fund_id is not null then
    select *
    into matched_fund
    from public.funds
    where id = target_fund_id;

    if not found then
      raise exception 'Fund not found';
    end if;

    if matched_fund.organization_id <> target_organization_id then
      raise exception 'Fund does not belong to organization';
    end if;

    if matched_fund.status <> 'active' then
      raise exception 'Fund must be active';
    end if;
  end if;

  select *
  into existing_line
  from public.budget_lines
  where budget_id = target_budget_id
    and account_id = target_account_id
    and (
      (fund_id is null and target_fund_id is null)
      or fund_id = target_fund_id
    );

  if found then
    update public.budget_lines
    set
      amount = line_amount,
      updated_at = now()
    where id = existing_line.id
    returning *
    into upserted_line;
  else
    select coalesce(max(line_number), 0) + 1
    into next_line_number
    from public.budget_lines
    where budget_id = target_budget_id;

    insert into public.budget_lines (
      budget_id,
      account_id,
      fund_id,
      line_number,
      amount
    )
    values (
      target_budget_id,
      target_account_id,
      target_fund_id,
      next_line_number,
      line_amount
    )
    returning *
    into upserted_line;
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
    'budget_line.upserted',
    'budget_line',
    upserted_line.id,
    'user',
    auth.uid(),
    format(
      'Budget line %s for account %s set to %s',
      upserted_line.id,
      target_account_id,
      line_amount
    ),
    now()
  );

  return upserted_line;
end;
$$;

revoke all on function public.upsert_budget_line(uuid, uuid, uuid, numeric, uuid) from public;
revoke execute on function public.upsert_budget_line(uuid, uuid, uuid, numeric, uuid) from anon;
grant execute on function public.upsert_budget_line(uuid, uuid, uuid, numeric, uuid) to authenticated;

create or replace function public.activate_budget(
  target_organization_id uuid,
  target_budget_id uuid
)
returns public.budgets
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_budget public.budgets;
  activated_budget public.budgets;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_budget_id is null then
    raise exception 'Budget is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant']
  ) then
    raise exception 'Insufficient role to activate budget';
  end if;

  select *
  into matched_budget
  from public.budgets
  where id = target_budget_id
  for update;

  if not found then
    raise exception 'Budget not found';
  end if;

  if matched_budget.organization_id <> target_organization_id then
    raise exception 'Budget does not belong to organization';
  end if;

  if matched_budget.status <> 'draft' then
    raise exception 'Only draft budgets can be activated';
  end if;

  update public.budgets
  set
    status = 'active',
    updated_at = now()
  where id = matched_budget.id
  returning *
  into activated_budget;

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
    'budget.activated',
    'budget',
    activated_budget.id,
    'user',
    auth.uid(),
    format('Budget "%s" activated', activated_budget.name),
    now()
  );

  return activated_budget;
end;
$$;

revoke all on function public.activate_budget(uuid, uuid) from public;
revoke execute on function public.activate_budget(uuid, uuid) from anon;
grant execute on function public.activate_budget(uuid, uuid) to authenticated;
