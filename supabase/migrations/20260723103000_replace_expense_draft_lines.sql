-- Controlled draft expense line allocation write path via SECURITY DEFINER RPC.

create or replace function public.replace_expense_draft_lines(
  target_organization_id uuid,
  target_expense_id uuid,
  input_lines jsonb
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_expense public.expenses;
  updated_expense public.expenses;
  line_count integer;
  line_index integer;
  line_object jsonb;
  parsed_account_id uuid;
  parsed_fund_id uuid;
  matched_account public.accounts;
  matched_fund public.funds;
  line_amount numeric(18,2);
  normalized_line_description text;
  calculated_total numeric(18,2) := 0;
  assigned_line_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_expense_id is null then
    raise exception 'Expense is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to replace expense draft lines';
  end if;

  if input_lines is null then
    raise exception 'Allocation lines are required';
  end if;

  if jsonb_typeof(input_lines) <> 'array' then
    raise exception 'Allocation lines must be a JSON array';
  end if;

  line_count := jsonb_array_length(input_lines);

  if line_count < 1 then
    raise exception 'At least one allocation line is required';
  end if;

  if line_count > 50 then
    raise exception 'No more than 50 allocation lines are allowed';
  end if;

  select *
  into current_expense
  from public.expenses
  where id = target_expense_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Expense not found for organization';
  end if;

  if current_expense.status <> 'draft' then
    raise exception 'Expense is not in draft status';
  end if;

  drop table if exists pg_temp.validated_expense_draft_lines;

  create temp table validated_expense_draft_lines (
    line_number integer not null,
    account_id uuid not null,
    fund_id uuid,
    amount numeric(18,2) not null,
    description text
  ) on commit drop;

  for line_index in 0..(line_count - 1) loop
    line_object := input_lines -> line_index;
    assigned_line_number := line_index + 1;

    if jsonb_typeof(line_object) <> 'object' then
      raise exception 'Each allocation line must be a JSON object';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(line_object) as object_key
      where object_key not in ('account_id', 'fund_id', 'amount', 'description')
    ) then
      raise exception 'Allocation line contains unsupported fields';
    end if;

    if not (line_object ? 'account_id')
      or line_object ->> 'account_id' is null
      or btrim(line_object ->> 'account_id') = '' then
      raise exception 'Account is required for each allocation line';
    end if;

    begin
      parsed_account_id := (line_object ->> 'account_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Invalid account ID for allocation line';
    end;

    select *
    into matched_account
    from public.accounts
    where id = parsed_account_id;

    if not found then
      raise exception 'Account not found';
    end if;

    if matched_account.organization_id <> target_organization_id then
      raise exception 'Account does not belong to organization';
    end if;

    if matched_account.account_type <> 'expense' then
      raise exception 'Account must be an expense account';
    end if;

    if matched_account.status <> 'active' then
      raise exception 'Account must be active';
    end if;

    if matched_account.is_posting is not true then
      raise exception 'Account must be a posting account';
    end if;

    parsed_fund_id := null;

    if line_object ? 'fund_id'
      and line_object ->> 'fund_id' is not null
      and btrim(line_object ->> 'fund_id') <> '' then
      begin
        parsed_fund_id := (line_object ->> 'fund_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Invalid fund ID for allocation line';
      end;

      select *
      into matched_fund
      from public.funds
      where id = parsed_fund_id;

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

    if not (line_object ? 'amount') or line_object ->> 'amount' is null then
      raise exception 'Amount is required for each allocation line';
    end if;

    begin
      line_amount := (line_object ->> 'amount')::numeric(18,2);
    exception
      when invalid_text_representation then
        raise exception 'Invalid amount for allocation line';
    end;

    if line_amount is null or line_amount <= 0 then
      raise exception 'Amount must be greater than zero';
    end if;

    if line_amount <> round(line_amount, 2) then
      raise exception 'Amount must have at most 2 decimal places';
    end if;

    if line_amount > 9999999999999999.99 then
      raise exception 'Amount exceeds maximum supported precision';
    end if;

    if line_object ? 'description' and line_object ->> 'description' is not null then
      normalized_line_description := btrim(line_object ->> 'description');

      if normalized_line_description = '' then
        raise exception 'Allocation line description cannot be blank';
      end if;
    else
      normalized_line_description := null;
    end if;

    calculated_total := calculated_total + line_amount;

    insert into validated_expense_draft_lines (
      line_number,
      account_id,
      fund_id,
      amount,
      description
    )
    values (
      assigned_line_number,
      parsed_account_id,
      parsed_fund_id,
      line_amount,
      normalized_line_description
    );
  end loop;

  if calculated_total <= 0 then
    raise exception 'Total amount must be greater than zero';
  end if;

  if calculated_total > 9999999999999999.99 then
    raise exception 'Total amount exceeds maximum supported precision';
  end if;

  delete from public.expense_lines
  where expense_id = target_expense_id;

  insert into public.expense_lines (
    expense_id,
    account_id,
    fund_id,
    line_number,
    description,
    amount
  )
  select
    target_expense_id,
    validated_line.account_id,
    validated_line.fund_id,
    validated_line.line_number,
    validated_line.description,
    validated_line.amount
  from validated_expense_draft_lines as validated_line
  order by validated_line.line_number;

  update public.expenses
  set
    total_amount = calculated_total,
    updated_at = now()
  where id = target_expense_id
    and organization_id = target_organization_id
  returning *
  into updated_expense;

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
    'expense.draft_lines_replaced',
    'expense',
    target_expense_id,
    'user',
    auth.uid(),
    format(
      'Draft expense "%s" allocation updated (%s lines, total %s)',
      current_expense.description,
      line_count,
      calculated_total
    ),
    now()
  );

  return updated_expense;
end;
$$;

comment on function public.replace_expense_draft_lines(uuid, uuid, jsonb) is
  'Replaces all allocation lines on a draft expense for staff+ members, recalculates expenses.total_amount from validated line amounts, and appends one audit_events row with actor_user_id attribution atomically. SECURITY DEFINER is the narrow authenticated write boundary for draft expense line allocation; line numbers and totals are database-controlled. Recording, journal posting, and voiding are separate workflows. No direct expense_lines INSERT/UPDATE/DELETE RLS.';

revoke all on function public.replace_expense_draft_lines(uuid, uuid, jsonb) from public;
revoke execute on function public.replace_expense_draft_lines(uuid, uuid, jsonb) from anon;
grant execute on function public.replace_expense_draft_lines(uuid, uuid, jsonb) to authenticated;
