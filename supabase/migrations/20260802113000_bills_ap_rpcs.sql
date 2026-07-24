-- Bills AP write paths: create, open, pay, and void via SECURITY DEFINER RPCs.

create or replace function public.create_bill(
  target_organization_id uuid,
  input_vendor_id uuid,
  input_bill_date date,
  input_total_amount numeric,
  input_bill_number text default null,
  input_due_date date default null,
  input_description text default null,
  input_status text default 'draft',
  input_expense_account_id uuid default null,
  input_fund_id uuid default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_bill_number text;
  normalized_description text;
  normalized_status text;
  matched_vendor public.vendors;
  matched_expense_account public.accounts;
  matched_fund public.funds;
  created_bill public.bills;
  line_description text;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if input_vendor_id is null then
    raise exception 'Vendor is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to create bill';
  end if;

  if input_bill_date is null then
    raise exception 'Bill date is required';
  end if;

  if input_total_amount is null or input_total_amount <= 0 then
    raise exception 'Total amount must be greater than zero';
  end if;

  if input_bill_number is not null and btrim(input_bill_number) = '' then
    raise exception 'Bill number cannot be blank';
  end if;

  if input_description is not null and btrim(input_description) = '' then
    raise exception 'Bill description cannot be blank';
  end if;

  normalized_bill_number := nullif(btrim(input_bill_number), '');
  normalized_description := nullif(btrim(input_description), '');
  normalized_status := lower(btrim(coalesce(input_status, 'draft')));

  if normalized_status not in ('draft', 'open') then
    raise exception 'Bill status must be draft or open';
  end if;

  select *
  into matched_vendor
  from public.vendors
  where id = input_vendor_id;

  if not found then
    raise exception 'Vendor not found';
  end if;

  if matched_vendor.organization_id <> target_organization_id then
    raise exception 'Vendor does not belong to organization';
  end if;

  if input_expense_account_id is not null then
    select *
    into matched_expense_account
    from public.accounts
    where id = input_expense_account_id;

    if not found then
      raise exception 'Expense account not found';
    end if;

    if matched_expense_account.organization_id <> target_organization_id then
      raise exception 'Expense account does not belong to organization';
    end if;

    if matched_expense_account.status <> 'active' then
      raise exception 'Expense account must be active';
    end if;

    if matched_expense_account.is_posting is not true then
      raise exception 'Expense account must be a posting account';
    end if;

    if matched_expense_account.account_type <> 'expense' then
      raise exception 'Expense account must be an expense account';
    end if;
  end if;

  if input_fund_id is not null then
    select *
    into matched_fund
    from public.funds
    where id = input_fund_id;

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

  insert into public.bills (
    organization_id,
    vendor_id,
    bill_number,
    bill_date,
    due_date,
    description,
    total_amount,
    status
  )
  values (
    target_organization_id,
    input_vendor_id,
    normalized_bill_number,
    input_bill_date,
    input_due_date,
    normalized_description,
    input_total_amount,
    normalized_status
  )
  returning *
  into created_bill;

  if input_expense_account_id is not null then
    line_description := coalesce(
      normalized_description,
      coalesce(normalized_bill_number, 'Bill total')
    );

    insert into public.bill_lines (
      bill_id,
      account_id,
      fund_id,
      line_number,
      description,
      amount
    )
    values (
      created_bill.id,
      input_expense_account_id,
      input_fund_id,
      1,
      line_description,
      input_total_amount
    );
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
    'bill.created',
    'bill',
    created_bill.id,
    'user',
    auth.uid(),
    format(
      'Bill created for %s (total %s)',
      coalesce(normalized_bill_number, normalized_description, 'vendor bill'),
      input_total_amount
    ),
    now()
  );

  return created_bill;
end;
$$;

revoke all on function public.create_bill(uuid, uuid, date, numeric, text, date, text, text, uuid, uuid) from public;
revoke execute on function public.create_bill(uuid, uuid, date, numeric, text, date, text, text, uuid, uuid) from anon;
grant execute on function public.create_bill(uuid, uuid, date, numeric, text, date, text, text, uuid, uuid) to authenticated;

create or replace function public.open_bill(
  target_organization_id uuid,
  target_bill_id uuid
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bill public.bills;
  updated_bill public.bills;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_bill_id is null then
    raise exception 'Bill is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to open bill';
  end if;

  select *
  into current_bill
  from public.bills
  where id = target_bill_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Bill not found for organization';
  end if;

  if current_bill.status <> 'draft' then
    raise exception 'Bill is not in draft status';
  end if;

  update public.bills
  set
    status = 'open',
    updated_at = now()
  where id = target_bill_id
    and organization_id = target_organization_id
  returning *
  into updated_bill;

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
    'bill.opened',
    'bill',
    target_bill_id,
    'user',
    auth.uid(),
    format(
      'Bill "%s" opened',
      coalesce(
        nullif(btrim(updated_bill.bill_number), ''),
        nullif(btrim(updated_bill.description), ''),
        updated_bill.id::text
      )
    ),
    now()
  );

  return updated_bill;
end;
$$;

revoke all on function public.open_bill(uuid, uuid) from public;
revoke execute on function public.open_bill(uuid, uuid) from anon;
grant execute on function public.open_bill(uuid, uuid) to authenticated;

create or replace function public.pay_bill(
  target_organization_id uuid,
  target_bill_id uuid,
  input_payment_date date,
  input_cash_account_id uuid,
  input_expense_account_id uuid,
  input_fund_id uuid default null
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bill public.bills;
  updated_bill public.bills;
  matched_period public.accounting_periods;
  matched_cash_account public.accounts;
  matched_expense_account public.accounts;
  period_count integer;
  created_journal_entry_id uuid;
  created_payment_id uuid;
  generated_entry_number text;
  journal_description text;
  total_debits numeric(18,2);
  total_credits numeric(18,2);
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_bill_id is null then
    raise exception 'Bill is required';
  end if;

  if input_payment_date is null then
    raise exception 'Payment date is required';
  end if;

  if input_cash_account_id is null then
    raise exception 'Cash account is required';
  end if;

  if input_expense_account_id is null then
    raise exception 'Expense account is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to pay bill';
  end if;

  select *
  into current_bill
  from public.bills
  where id = target_bill_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Bill not found for organization';
  end if;

  if current_bill.status <> 'open' then
    raise exception 'Bill is not in open status';
  end if;

  if exists (
    select 1
    from public.bill_payments existing_payment
    where existing_payment.bill_id = target_bill_id
      and existing_payment.organization_id = target_organization_id
      and existing_payment.status = 'recorded'
  ) then
    raise exception 'Bill already has a recorded payment';
  end if;

  if current_bill.total_amount <= 0 then
    raise exception 'Bill amount must be greater than zero';
  end if;

  if input_fund_id is not null then
    if not exists (
      select 1
      from public.funds payment_fund
      where payment_fund.id = input_fund_id
        and payment_fund.organization_id = target_organization_id
        and payment_fund.status = 'active'
    ) then
      raise exception 'Invalid payment fund';
    end if;
  end if;

  select count(*)
  into period_count
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and input_payment_date >= ap.start_date
    and input_payment_date <= ap.end_date;

  if period_count <> 1 then
    raise exception 'Accounting period could not be resolved for payment date';
  end if;

  select *
  into matched_period
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and input_payment_date >= ap.start_date
    and input_payment_date <= ap.end_date;

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
  into matched_cash_account
  from public.accounts
  where id = input_cash_account_id;

  if not found then
    raise exception 'Cash account not found';
  end if;

  if matched_cash_account.organization_id <> target_organization_id then
    raise exception 'Cash account does not belong to organization';
  end if;

  if matched_cash_account.status <> 'active' then
    raise exception 'Cash account must be active';
  end if;

  if matched_cash_account.is_posting is not true then
    raise exception 'Cash account must be a posting account';
  end if;

  if matched_cash_account.account_type <> 'asset' then
    raise exception 'Cash account must be an asset account';
  end if;

  select *
  into matched_expense_account
  from public.accounts
  where id = input_expense_account_id;

  if not found then
    raise exception 'Expense account not found';
  end if;

  if matched_expense_account.organization_id <> target_organization_id then
    raise exception 'Expense account does not belong to organization';
  end if;

  if matched_expense_account.status <> 'active' then
    raise exception 'Expense account must be active';
  end if;

  if matched_expense_account.is_posting is not true then
    raise exception 'Expense account must be a posting account';
  end if;

  if matched_expense_account.account_type <> 'expense' then
    raise exception 'Expense account must be an expense account';
  end if;

  generated_entry_number := format(
    'BILL-%s',
    upper(replace(target_bill_id::text, '-', ''))
  );

  journal_description := coalesce(
    nullif(btrim(current_bill.description), ''),
    nullif(btrim(current_bill.bill_number), ''),
    format('Bill payment on %s', input_payment_date)
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
    input_payment_date,
    journal_description,
    'bill',
    target_bill_id,
    'posted'
  )
  returning id
  into created_journal_entry_id;

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
    input_expense_account_id,
    input_fund_id,
    1,
    journal_description,
    current_bill.total_amount,
    0
  );

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
    input_cash_account_id,
    input_fund_id,
    2,
    journal_description,
    0,
    current_bill.total_amount
  );

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

  if total_debits <> current_bill.total_amount then
    raise exception 'Journal entry total does not match bill amount';
  end if;

  insert into public.bill_payments (
    organization_id,
    bill_id,
    payment_date,
    amount,
    reference,
    status
  )
  values (
    target_organization_id,
    target_bill_id,
    input_payment_date,
    current_bill.total_amount,
    generated_entry_number,
    'recorded'
  )
  returning id
  into created_payment_id;

  update public.bills
  set
    status = 'paid',
    updated_at = now()
  where id = target_bill_id
    and organization_id = target_organization_id
  returning *
  into updated_bill;

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
    'bill.paid',
    'bill',
    target_bill_id,
    'user',
    auth.uid(),
    format(
      'Bill "%s" paid as journal %s (total %s)',
      coalesce(
        nullif(btrim(current_bill.bill_number), ''),
        journal_description
      ),
      generated_entry_number,
      current_bill.total_amount
    ),
    now()
  );

  return updated_bill;
end;
$$;

comment on function public.pay_bill(uuid, uuid, date, uuid, uuid, uuid) is
  'Pays an open bill for staff+ members by creating a posted bill-sourced journal entry (DR expense, CR cash), a bill_payments row, setting status to paid, and appending one audit_events row with actor_user_id attribution atomically. SECURITY DEFINER is the narrow authenticated write boundary.';

revoke all on function public.pay_bill(uuid, uuid, date, uuid, uuid, uuid) from public;
revoke execute on function public.pay_bill(uuid, uuid, date, uuid, uuid, uuid) from anon;
grant execute on function public.pay_bill(uuid, uuid, date, uuid, uuid, uuid) to authenticated;

create or replace function public.void_bill(
  target_organization_id uuid,
  target_bill_id uuid
)
returns public.bills
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bill public.bills;
  updated_bill public.bills;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_bill_id is null then
    raise exception 'Bill is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to void bill';
  end if;

  select *
  into current_bill
  from public.bills
  where id = target_bill_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Bill not found for organization';
  end if;

  if current_bill.status not in ('draft', 'open') then
    raise exception 'Bill cannot be voided in its current status';
  end if;

  if exists (
    select 1
    from public.bill_payments existing_payment
    where existing_payment.bill_id = target_bill_id
      and existing_payment.organization_id = target_organization_id
      and existing_payment.status = 'recorded'
  ) then
    raise exception 'Paid bills cannot be voided';
  end if;

  update public.bills
  set
    status = 'void',
    updated_at = now()
  where id = target_bill_id
    and organization_id = target_organization_id
  returning *
  into updated_bill;

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
    'bill.voided',
    'bill',
    target_bill_id,
    'user',
    auth.uid(),
    format(
      'Bill "%s" voided',
      coalesce(
        nullif(btrim(current_bill.bill_number), ''),
        nullif(btrim(current_bill.description), ''),
        current_bill.id::text
      )
    ),
    now()
  );

  return updated_bill;
end;
$$;

revoke all on function public.void_bill(uuid, uuid) from public;
revoke execute on function public.void_bill(uuid, uuid) from anon;
grant execute on function public.void_bill(uuid, uuid) to authenticated;
