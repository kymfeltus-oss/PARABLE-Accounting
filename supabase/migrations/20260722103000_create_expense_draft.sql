-- Controlled draft expense header create write path via SECURITY DEFINER RPC.

create or replace function public.create_expense_draft(
  target_organization_id uuid,
  input_expense_date date,
  input_description text,
  input_total_amount numeric,
  input_vendor_id uuid default null,
  input_reference text default null,
  input_payment_source text default 'other'
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_description text;
  normalized_reference text;
  normalized_payment_source text;
  matched_vendor public.vendors;
  created_expense public.expenses;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = target_organization_id
  ) then
    raise exception 'Organization not found';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to create draft expense';
  end if;

  if input_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  normalized_description := btrim(input_description);

  if normalized_description = '' then
    raise exception 'Expense description is required';
  end if;

  if input_total_amount is null or input_total_amount <= 0 then
    raise exception 'Total amount must be greater than zero';
  end if;

  normalized_payment_source := btrim(input_payment_source);

  if normalized_payment_source not in (
    'bank',
    'card',
    'cash',
    'reimbursement',
    'other'
  ) then
    raise exception 'Invalid payment source';
  end if;

  if input_reference is not null and btrim(input_reference) = '' then
    raise exception 'Expense reference cannot be blank';
  end if;

  normalized_reference := nullif(btrim(input_reference), '');

  if input_vendor_id is not null then
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
  end if;

  insert into public.expenses (
    organization_id,
    vendor_id,
    expense_date,
    description,
    total_amount,
    reference,
    payment_source,
    status
  )
  values (
    target_organization_id,
    input_vendor_id,
    input_expense_date,
    normalized_description,
    input_total_amount,
    normalized_reference,
    normalized_payment_source,
    'draft'
  )
  returning *
  into created_expense;

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
    'expense.created',
    'expense',
    created_expense.id,
    'user',
    auth.uid(),
    format('Draft expense "%s" created', normalized_description),
    now()
  );

  return created_expense;
end;
$$;

comment on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) is
  'Creates a draft expense header for staff+ members and appends an audit_events row with actor_user_id attribution atomically. SECURITY DEFINER is the narrow authenticated write boundary for draft expense headers; line allocation, recording, journal posting, and voiding are separate workflows. No direct table INSERT RLS.';

revoke all on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) from public;
revoke execute on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) from anon;
grant execute on function public.create_expense_draft(uuid, date, text, numeric, uuid, text, text) to authenticated;
