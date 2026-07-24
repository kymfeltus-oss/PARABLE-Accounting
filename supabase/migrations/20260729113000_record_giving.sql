create or replace function public.record_giving(
  target_organization_id uuid,
  target_giving_transaction_id uuid,
  input_debit_account_id uuid,
  input_credit_account_id uuid
)
returns public.giving_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_giving public.giving_transactions;
  updated_giving public.giving_transactions;
  matched_period public.accounting_periods;
  matched_debit_account public.accounts;
  matched_credit_account public.accounts;
  period_count integer;
  created_journal_entry_id uuid;
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

  if target_giving_transaction_id is null then
    raise exception 'Giving transaction is required';
  end if;

  if input_debit_account_id is null then
    raise exception 'Debit account is required';
  end if;

  if input_credit_account_id is null then
    raise exception 'Credit account is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to record giving';
  end if;

  select *
  into current_giving
  from public.giving_transactions
  where id = target_giving_transaction_id
    and organization_id = target_organization_id
  for update;

  if not found then
    raise exception 'Giving transaction not found for organization';
  end if;

  if current_giving.status <> 'recorded' then
    raise exception 'Giving transaction is not in recorded status';
  end if;

  if current_giving.journal_entry_id is not null then
    raise exception 'Giving transaction is already linked to a journal entry';
  end if;

  if exists (
    select 1
    from public.journal_entries existing_journal
    where existing_journal.organization_id = target_organization_id
      and existing_journal.source_type = 'giving'
      and existing_journal.source_id = target_giving_transaction_id
  ) then
    raise exception 'Giving transaction already has a recorded journal entry';
  end if;

  if current_giving.amount <= 0 then
    raise exception 'Giving amount must be greater than zero';
  end if;

  if current_giving.fund_id is not null then
    if not exists (
      select 1
      from public.funds giving_fund
      where giving_fund.id = current_giving.fund_id
        and giving_fund.organization_id = target_organization_id
        and giving_fund.status = 'active'
    ) then
      raise exception 'Invalid giving fund';
    end if;
  end if;

  select count(*)
  into period_count
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and current_giving.transaction_date >= ap.start_date
    and current_giving.transaction_date <= ap.end_date;

  if period_count <> 1 then
    raise exception 'Accounting period could not be resolved for giving date';
  end if;

  select *
  into matched_period
  from public.accounting_periods ap
  where ap.organization_id = target_organization_id
    and current_giving.transaction_date >= ap.start_date
    and current_giving.transaction_date <= ap.end_date;

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
  into matched_debit_account
  from public.accounts
  where id = input_debit_account_id;

  if not found then
    raise exception 'Debit account not found';
  end if;

  if matched_debit_account.organization_id <> target_organization_id then
    raise exception 'Debit account does not belong to organization';
  end if;

  if matched_debit_account.status <> 'active' then
    raise exception 'Debit account must be active';
  end if;

  if matched_debit_account.is_posting is not true then
    raise exception 'Debit account must be a posting account';
  end if;

  case current_giving.giving_method
    when 'cash' then
      if matched_debit_account.account_type <> 'asset' then
        raise exception 'Debit account must be an asset account for cash giving method';
      end if;
    when 'check' then
      if matched_debit_account.account_type <> 'asset' then
        raise exception 'Debit account must be an asset account for check giving method';
      end if;
    when 'ach' then
      if matched_debit_account.account_type <> 'asset' then
        raise exception 'Debit account must be an asset account for ach giving method';
      end if;
    when 'card' then
      if matched_debit_account.account_type not in ('asset', 'liability') then
        raise exception 'Debit account must be an asset or liability account for card giving method';
      end if;
    when 'other' then
      if matched_debit_account.account_type not in ('asset', 'liability') then
        raise exception 'Debit account must be an asset or liability account for other giving method';
      end if;
    else
      raise exception 'Invalid giving method';
  end case;

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

  if matched_credit_account.account_type <> 'revenue' then
    raise exception 'Credit account must be a revenue account';
  end if;

  generated_entry_number := format(
    'GIV-%s',
    upper(replace(target_giving_transaction_id::text, '-', ''))
  );

  journal_description := coalesce(
    nullif(btrim(current_giving.reference), ''),
    format('Giving on %s', current_giving.transaction_date)
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
    current_giving.transaction_date,
    journal_description,
    'giving',
    target_giving_transaction_id,
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
    input_debit_account_id,
    current_giving.fund_id,
    1,
    journal_description,
    current_giving.amount,
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
    input_credit_account_id,
    current_giving.fund_id,
    2,
    journal_description,
    0,
    current_giving.amount
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

  if total_debits <> current_giving.amount then
    raise exception 'Journal entry total does not match giving amount';
  end if;

  update public.giving_transactions
  set
    journal_entry_id = created_journal_entry_id,
    updated_at = now()
  where id = target_giving_transaction_id
    and organization_id = target_organization_id
  returning *
  into updated_giving;

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
    'giving.recorded',
    'giving_transaction',
    target_giving_transaction_id,
    'user',
    auth.uid(),
    format(
      'Giving "%s" recorded as journal %s (total %s)',
      coalesce(nullif(btrim(current_giving.reference), ''), journal_description),
      generated_entry_number,
      current_giving.amount
    ),
    now()
  );

  return updated_giving;
end;
$$;

comment on function public.record_giving(uuid, uuid, uuid, uuid) is
  'Records an operational giving transaction for staff+ members by creating a posted giving-sourced journal entry with balanced debit and credit lines, linking giving_transactions.journal_entry_id, and appending one audit_events row with actor_user_id attribution atomically. Entry numbers are derived deterministically from the full giving transaction ID (GIV-{compact-uuid}). SECURITY DEFINER is the narrow authenticated write boundary; voiding and reversal are separate workflows.';

revoke all on function public.record_giving(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.record_giving(uuid, uuid, uuid, uuid) from anon;
grant execute on function public.record_giving(uuid, uuid, uuid, uuid) to authenticated;
