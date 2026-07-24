-- Banking basics write paths: bank accounts, transactions, and manual matching.

create or replace function public.create_bank_account(
  target_organization_id uuid,
  input_name text,
  input_account_id uuid,
  input_institution_name text default null,
  input_account_type text default 'checking',
  input_last_four text default null
)
returns public.bank_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_institution text;
  normalized_type text;
  normalized_last_four text;
  matched_account public.accounts;
  created_bank_account public.bank_accounts;
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
    raise exception 'Insufficient role to create bank account';
  end if;

  normalized_name := btrim(input_name);

  if normalized_name = '' then
    raise exception 'Bank account name is required';
  end if;

  if input_account_id is null then
    raise exception 'Chart account is required';
  end if;

  if input_institution_name is not null and btrim(input_institution_name) = '' then
    raise exception 'Institution name cannot be blank';
  end if;

  normalized_institution := nullif(btrim(input_institution_name), '');
  normalized_type := lower(btrim(coalesce(input_account_type, 'checking')));
  normalized_last_four := nullif(btrim(input_last_four), '');

  if normalized_type not in ('checking', 'savings', 'money_market') then
    raise exception 'Bank account type is invalid';
  end if;

  if normalized_last_four is not null and normalized_last_four !~ '^[0-9]{4}$' then
    raise exception 'Last four digits must be exactly four numbers';
  end if;

  select *
  into matched_account
  from public.accounts
  where id = input_account_id;

  if not found then
    raise exception 'Chart account not found';
  end if;

  if matched_account.organization_id <> target_organization_id then
    raise exception 'Chart account does not belong to organization';
  end if;

  if matched_account.status <> 'active' then
    raise exception 'Chart account must be active';
  end if;

  if matched_account.is_posting is not true then
    raise exception 'Chart account must be a posting account';
  end if;

  if matched_account.account_type <> 'asset' then
    raise exception 'Chart account must be an asset account';
  end if;

  insert into public.bank_accounts (
    organization_id,
    account_id,
    name,
    institution_name,
    account_type,
    last_four,
    status
  )
  values (
    target_organization_id,
    input_account_id,
    normalized_name,
    normalized_institution,
    normalized_type,
    normalized_last_four,
    'active'
  )
  returning *
  into created_bank_account;

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
    'bank_account.created',
    'bank_account',
    created_bank_account.id,
    'user',
    auth.uid(),
    format('Bank account "%s" created', normalized_name),
    now()
  );

  return created_bank_account;
end;
$$;

comment on function public.create_bank_account(uuid, text, uuid, text, text, text) is
  'Creates a bank account linked to an active posting asset chart account for staff+ members. SECURITY DEFINER is the narrow authenticated write boundary.';

revoke all on function public.create_bank_account(uuid, text, uuid, text, text, text) from public;
revoke execute on function public.create_bank_account(uuid, text, uuid, text, text, text) from anon;
grant execute on function public.create_bank_account(uuid, text, uuid, text, text, text) to authenticated;

create or replace function public.create_bank_transaction(
  target_organization_id uuid,
  input_bank_account_id uuid,
  input_transaction_date date,
  input_amount numeric,
  input_description text default null,
  input_transaction_type text default null
)
returns public.bank_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_description text;
  normalized_transaction_type text;
  signed_amount numeric;
  matched_bank_account public.bank_accounts;
  created_transaction public.bank_transactions;
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
    raise exception 'Insufficient role to create bank transaction';
  end if;

  if input_bank_account_id is null then
    raise exception 'Bank account is required';
  end if;

  if input_transaction_date is null then
    raise exception 'Transaction date is required';
  end if;

  if input_amount is null or input_amount = 0 then
    raise exception 'Amount must be nonzero';
  end if;

  if input_description is not null and btrim(input_description) = '' then
    raise exception 'Transaction description cannot be blank';
  end if;

  normalized_description := coalesce(nullif(btrim(input_description), ''), 'Bank transaction');
  normalized_transaction_type := nullif(lower(btrim(input_transaction_type)), '');

  if normalized_transaction_type is not null
    and normalized_transaction_type not in ('inbound', 'outbound') then
    raise exception 'Transaction type must be inbound or outbound';
  end if;

  if normalized_transaction_type = 'inbound' then
    signed_amount := abs(input_amount);
  elsif normalized_transaction_type = 'outbound' then
    signed_amount := -abs(input_amount);
  else
    signed_amount := input_amount;
  end if;

  if signed_amount = 0 then
    raise exception 'Amount must be nonzero';
  end if;

  select *
  into matched_bank_account
  from public.bank_accounts
  where id = input_bank_account_id;

  if not found then
    raise exception 'Bank account not found';
  end if;

  if matched_bank_account.organization_id <> target_organization_id then
    raise exception 'Bank account does not belong to organization';
  end if;

  if matched_bank_account.status <> 'active' then
    raise exception 'Bank account must be active';
  end if;

  insert into public.bank_transactions (
    organization_id,
    bank_account_id,
    transaction_date,
    description,
    amount,
    source_type,
    status
  )
  values (
    target_organization_id,
    input_bank_account_id,
    input_transaction_date,
    normalized_description,
    signed_amount,
    'manual',
    'unmatched'
  )
  returning *
  into created_transaction;

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
    'bank_transaction.created',
    'bank_transaction',
    created_transaction.id,
    'user',
    auth.uid(),
    format(
      'Bank transaction created for %s on %s',
      signed_amount,
      input_transaction_date
    ),
    now()
  );

  return created_transaction;
end;
$$;

comment on function public.create_bank_transaction(uuid, uuid, date, numeric, text, text) is
  'Creates a manual bank transaction with signed amount semantics. Optional transaction_type inbound/outbound applies sign to the amount magnitude. SECURITY DEFINER is the narrow authenticated write boundary.';

revoke all on function public.create_bank_transaction(uuid, uuid, date, numeric, text, text) from public;
revoke execute on function public.create_bank_transaction(uuid, uuid, date, numeric, text, text) from anon;
grant execute on function public.create_bank_transaction(uuid, uuid, date, numeric, text, text) to authenticated;

create or replace function public.match_bank_transaction(
  target_organization_id uuid,
  input_bank_transaction_id uuid,
  input_match_type text,
  input_matched_source_id uuid
)
returns public.bank_transaction_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_match_type text;
  matched_transaction public.bank_transactions;
  matched_amount numeric;
  created_match public.bank_transaction_matches;
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
    raise exception 'Insufficient role to match bank transaction';
  end if;

  if input_bank_transaction_id is null then
    raise exception 'Bank transaction is required';
  end if;

  if input_matched_source_id is null then
    raise exception 'Matched source is required';
  end if;

  normalized_match_type := lower(btrim(input_match_type));

  if normalized_match_type not in (
    'bill_payment',
    'expense',
    'giving_transaction',
    'journal_entry'
  ) then
    raise exception 'Match type is invalid';
  end if;

  select *
  into matched_transaction
  from public.bank_transactions
  where id = input_bank_transaction_id;

  if not found then
    raise exception 'Bank transaction not found';
  end if;

  if matched_transaction.organization_id <> target_organization_id then
    raise exception 'Bank transaction does not belong to organization';
  end if;

  if matched_transaction.status = 'matched' then
    raise exception 'Bank transaction is already matched';
  end if;

  if matched_transaction.status = 'excluded' then
    raise exception 'Bank transaction is excluded';
  end if;

  if normalized_match_type = 'bill_payment' then
    perform 1
    from public.bill_payments
    where id = input_matched_source_id
      and organization_id = target_organization_id;

    if not found then
      raise exception 'Bill payment not found';
    end if;
  elsif normalized_match_type = 'expense' then
    perform 1
    from public.expenses
    where id = input_matched_source_id
      and organization_id = target_organization_id;

    if not found then
      raise exception 'Expense not found';
    end if;
  elsif normalized_match_type = 'giving_transaction' then
    perform 1
    from public.giving_transactions
    where id = input_matched_source_id
      and organization_id = target_organization_id;

    if not found then
      raise exception 'Giving transaction not found';
    end if;
  elsif normalized_match_type = 'journal_entry' then
    perform 1
    from public.journal_entries
    where id = input_matched_source_id
      and organization_id = target_organization_id;

    if not found then
      raise exception 'Journal entry not found';
    end if;
  end if;

  matched_amount := abs(matched_transaction.amount);

  insert into public.bank_transaction_matches (
    organization_id,
    bank_transaction_id,
    source_type,
    source_id,
    matched_amount,
    status
  )
  values (
    target_organization_id,
    input_bank_transaction_id,
    normalized_match_type,
    input_matched_source_id,
    matched_amount,
    'confirmed'
  )
  returning *
  into created_match;

  update public.bank_transactions
  set
    status = 'matched',
    updated_at = now()
  where id = input_bank_transaction_id;

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
    'bank_transaction.matched',
    'bank_transaction',
    input_bank_transaction_id,
    'user',
    auth.uid(),
    format(
      'Bank transaction matched to %s %s',
      normalized_match_type,
      input_matched_source_id
    ),
    now()
  );

  return created_match;
end;
$$;

comment on function public.match_bank_transaction(uuid, uuid, text, uuid) is
  'Marks a bank transaction as matched to a ledger source and records a confirmed bank_transaction_matches row. SECURITY DEFINER is the narrow authenticated write boundary.';

revoke all on function public.match_bank_transaction(uuid, uuid, text, uuid) from public;
revoke execute on function public.match_bank_transaction(uuid, uuid, text, uuid) from anon;
grant execute on function public.match_bank_transaction(uuid, uuid, text, uuid) to authenticated;
