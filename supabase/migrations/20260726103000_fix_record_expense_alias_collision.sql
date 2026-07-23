-- Corrective replacement for record_expense PL/pgSQL record/table alias collisions.

create or replace function public.record_expense(
  target_organization_id uuid,
  target_expense_id uuid,
  input_credit_account_id uuid
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_expense public.expenses;
  updated_expense public.expenses;
  matched_period public.accounting_periods;
  matched_credit_account public.accounts;
  period_count integer;
  line_count integer;
  line_total numeric(18,2);
  created_journal_entry_id uuid;
  generated_entry_number text;
  debit_line_number integer;
  credit_line_number integer;
  total_debits numeric(18,2);
  total_credits numeric(18,2);
  expense_line_record record;
  fund_bucket_record record;
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

  if input_credit_account_id is null then
    raise exception 'Credit account is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to record expense';
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

  if current_expense.journal_entry_id is not null then
    raise exception 'Expense is already linked to a journal entry';
  end if;

  if exists (
    select 1
    from public.journal_entries existing_journal
    where existing_journal.organization_id = target_organization_id
      and existing_journal.source_type = 'expense'
      and existing_journal.source_id = target_expense_id
  ) then
    raise exception 'Expense already has a recorded journal entry';
  end if;

  select
    count(*),
    coalesce(sum(el.amount), 0)
  into
    line_count,
    line_total
  from public.expense_lines el
  where el.expense_id = target_expense_id;

  if line_count < 1 then
    raise exception 'At least one expense line is required';
  end if;

  if line_total <= 0 then
    raise exception 'Total amount must be greater than zero';
  end if;

  if line_total <> current_expense.total_amount then
    raise exception 'Expense line total does not match header total';
  end if;

  if exists (
    select 1
    from public.expense_lines el
    inner join public.accounts da
      on da.id = el.account_id
    where el.expense_id = target_expense_id
      and (
        da.organization_id <> target_organization_id
        or da.account_type <> 'expense'
        or da.status <> 'active'
        or da.is_posting is not true
      )
  ) then
    raise exception 'Invalid expense line account';
  end if;

  if exists (
    select 1
    from public.expense_lines el
    inner join public.funds lf
      on lf.id = el.fund_id
    where el.expense_id = target_expense_id
      and el.fund_id is not null
      and (
        lf.organization_id <> target_organization_id
        or lf.status <> 'active'
      )
  ) then
    raise exception 'Invalid expense line fund';
  end if;

  select count(*)
  into period_count
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and current_expense.expense_date >= ap.start_date
    and current_expense.expense_date <= ap.end_date;

  if period_count <> 1 then
    raise exception 'Accounting period could not be resolved for expense date';
  end if;

  select *
  into matched_period
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and current_expense.expense_date >= ap.start_date
    and current_expense.expense_date <= ap.end_date;

  if matched_period.status = 'closed' then
    raise exception 'Accounting period is closed';
  end if;

  if matched_period.status = 'locked' then
    raise exception 'Accounting period is locked';
  end if;

  if matched_period.status <> 'open' then
    raise exception 'Accounting period is not open';
  end if;

  select *
  into matched_credit_account
  from public.accounts
  where id = input_credit_account_id;

  if not found then
    raise exception 'Credit account not found';
  end if;

  if matched_credit_account.organization_id <> target_organization_id then
    raise exception 'Credit account does not belong to organization';
  end if;

  if matched_credit_account.status <> 'active' then
    raise exception 'Credit account must be active';
  end if;

  if matched_credit_account.is_posting is not true then
    raise exception 'Credit account must be a posting account';
  end if;

  if matched_credit_account.account_type in ('revenue', 'expense', 'net_asset') then
    raise exception 'Credit account type is not allowed';
  end if;

  case current_expense.payment_source
    when 'bank' then
      if matched_credit_account.account_type <> 'asset' then
        raise exception 'Credit account must be an asset account for bank payment source';
      end if;
    when 'cash' then
      if matched_credit_account.account_type <> 'asset' then
        raise exception 'Credit account must be an asset account for cash payment source';
      end if;
    when 'card' then
      if matched_credit_account.account_type <> 'liability' then
        raise exception 'Credit account must be a liability account for card payment source';
      end if;
    when 'reimbursement' then
      if matched_credit_account.account_type <> 'liability' then
        raise exception 'Credit account must be a liability account for reimbursement payment source';
      end if;
    when 'other' then
      if matched_credit_account.account_type not in ('asset', 'liability') then
        raise exception 'Credit account must be an asset or liability account for other payment source';
      end if;
    else
      raise exception 'Invalid payment source';
  end case;

  generated_entry_number := format(
    'EXP-%s',
    upper(replace(target_expense_id::text, '-', ''))
  );

  insert into public.journal_entries (
    organization_id,
    accounting_period_id,
    entry_number,
    entry_date,
    description,
    source_type,
    source_id,
    status
  )
  values (
    target_organization_id,
    matched_period.id,
    generated_entry_number,
    current_expense.expense_date,
    current_expense.description,
    'expense',
    target_expense_id,
    'posted'
  )
  returning id
  into created_journal_entry_id;

  debit_line_number := 0;

  for expense_line_record in
    select *
    from public.expense_lines
    where expense_id = target_expense_id
    order by line_number asc
  loop
    debit_line_number := debit_line_number + 1;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      fund_id,
      line_number,
      description,
      debit_amount,
      credit_amount
    )
    values (
      created_journal_entry_id,
      expense_line_record.account_id,
      expense_line_record.fund_id,
      debit_line_number,
      coalesce(nullif(btrim(expense_line_record.description), ''), current_expense.description),
      expense_line_record.amount,
      0
    );
  end loop;

  credit_line_number := debit_line_number;

  for fund_bucket_record in
    select
      fb.fund_id,
      sum(fb.amount) as bucket_total
    from public.expense_lines fb
    where fb.expense_id = target_expense_id
    group by fb.fund_id
    order by fb.fund_id nulls last
  loop
    credit_line_number := credit_line_number + 1;

    insert into public.journal_entry_lines (
      journal_entry_id,
      account_id,
      fund_id,
      line_number,
      description,
      debit_amount,
      credit_amount
    )
    values (
      created_journal_entry_id,
      input_credit_account_id,
      fund_bucket_record.fund_id,
      credit_line_number,
      current_expense.description,
      0,
      fund_bucket_record.bucket_total
    );
  end loop;

  select
    coalesce(sum(jl.debit_amount), 0),
    coalesce(sum(jl.credit_amount), 0)
  into
    total_debits,
    total_credits
  from public.journal_entry_lines jl
  where jl.journal_entry_id = created_journal_entry_id;

  if total_debits <> total_credits then
    raise exception 'Journal entry is not balanced';
  end if;

  if total_debits <> line_total then
    raise exception 'Journal entry total does not match expense total';
  end if;

  if exists (
    select 1
    from (
      select
        jl.fund_id,
        sum(jl.debit_amount) as bucket_debits,
        sum(jl.credit_amount) as bucket_credits
      from public.journal_entry_lines jl
      where jl.journal_entry_id = created_journal_entry_id
      group by jl.fund_id
    ) as fund_bucket_balance
    where fund_bucket_balance.bucket_debits <> fund_bucket_balance.bucket_credits
  ) then
    raise exception 'Journal entry fund buckets are not balanced';
  end if;

  update public.expenses
  set
    status = 'recorded',
    journal_entry_id = created_journal_entry_id,
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
    'expense.recorded',
    'expense',
    target_expense_id,
    'user',
    auth.uid(),
    format(
      'Expense "%s" recorded as journal %s (total %s)',
      coalesce(nullif(btrim(current_expense.reference), ''), current_expense.description),
      generated_entry_number,
      line_total
    ),
    now()
  );

  return updated_expense;
end;
$$;

comment on function public.record_expense(uuid, uuid, uuid) is
  'Records a fully allocated draft expense for staff+ members by creating a posted expense-sourced journal entry with fund-balanced lines, linking expenses.journal_entry_id, setting status to recorded, and appending one audit_events row with actor_user_id attribution atomically. Entry numbers are derived deterministically from the full expense ID (EXP-{compact-uuid}) for concurrency-safe uniqueness. SECURITY DEFINER is the narrow authenticated write boundary; voiding and reversal are separate workflows. No direct table INSERT/UPDATE RLS.';

revoke all on function public.record_expense(uuid, uuid, uuid) from public;
revoke execute on function public.record_expense(uuid, uuid, uuid) from anon;
grant execute on function public.record_expense(uuid, uuid, uuid) to authenticated;
