-- Controlled giving intake write path via SECURITY DEFINER RPC.

create or replace function public.create_giving_transaction(
  target_organization_id uuid,
  input_transaction_date date,
  input_amount numeric,
  input_giving_method text default 'other',
  input_member_id uuid default null,
  input_fund_id uuid default null,
  input_reference text default null
)
returns public.giving_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_method text;
  normalized_reference text;
  matched_member public.members;
  matched_fund public.funds;
  created_giving public.giving_transactions;
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
    raise exception 'Insufficient role to create giving transaction';
  end if;

  if input_transaction_date is null then
    raise exception 'Transaction date is required';
  end if;

  if input_amount is null or input_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  normalized_method := lower(btrim(coalesce(input_giving_method, 'other')));

  if normalized_method not in (
    'cash',
    'check',
    'card',
    'ach',
    'other'
  ) then
    raise exception 'Invalid giving method';
  end if;

  if input_reference is not null and btrim(input_reference) = '' then
    raise exception 'Giving reference cannot be blank';
  end if;

  normalized_reference := nullif(btrim(input_reference), '');

  if input_member_id is not null then
    select *
    into matched_member
    from public.members
    where id = input_member_id;

    if not found then
      raise exception 'Member not found';
    end if;

    if matched_member.organization_id <> target_organization_id then
      raise exception 'Member does not belong to organization';
    end if;

    if matched_member.status <> 'active' then
      raise exception 'Member must be active';
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

  insert into public.giving_transactions (
    organization_id,
    member_id,
    fund_id,
    transaction_date,
    amount,
    giving_method,
    reference,
    status
  )
  values (
    target_organization_id,
    input_member_id,
    input_fund_id,
    input_transaction_date,
    input_amount,
    normalized_method,
    normalized_reference,
    'recorded'
  )
  returning *
  into created_giving;

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
    'giving.created',
    'giving_transaction',
    created_giving.id,
    'user',
    auth.uid(),
    format(
      'Giving transaction created for %s on %s',
      input_amount,
      input_transaction_date
    ),
    now()
  );

  return created_giving;
end;
$$;

comment on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) is
  'Creates a recorded giving transaction for staff+ members without journal posting and appends an audit_events row with actor_user_id attribution atomically. Ledger recording via record_giving is a separate workflow. SECURITY DEFINER is the narrow authenticated write boundary; no direct table INSERT RLS.';

revoke all on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) from public;
revoke execute on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) from anon;
grant execute on function public.create_giving_transaction(uuid, date, numeric, text, uuid, uuid, text) to authenticated;
