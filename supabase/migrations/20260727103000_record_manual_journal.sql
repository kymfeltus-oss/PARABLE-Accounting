create or replace function public.record_manual_journal(
  target_organization_id uuid,
  input_entry_date date,
  input_description text,
  input_period_id uuid,
  input_lines jsonb
)
returns public.journal_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_period public.accounting_periods;
  created_journal_entry public.journal_entries;
  created_journal_entry_id uuid;
  generated_entry_number text;
  line_item jsonb;
  line_index integer;
  line_count integer;
  line_account_id uuid;
  line_fund_id uuid;
  line_description text;
  line_debit numeric(18,2);
  line_credit numeric(18,2);
  total_debits numeric(18,2) := 0;
  total_credits numeric(18,2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if input_entry_date is null then
    raise exception 'Entry date is required';
  end if;

  if input_period_id is null then
    raise exception 'Accounting period is required';
  end if;

  if input_lines is null or jsonb_typeof(input_lines) <> 'array' then
    raise exception 'At least two journal lines are required';
  end if;

  line_count := jsonb_array_length(input_lines);

  if line_count < 2 then
    raise exception 'At least two journal lines are required';
  end if;

  if input_description is null or char_length(btrim(input_description)) = 0 then
    raise exception 'Description is required';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to record manual journal';
  end if;

  select *
  into matched_period
  from public.accounting_periods ap
  where ap.id = input_period_id;

  if not found then
    raise exception 'Accounting period not found';
  end if;

  if matched_period.organization_id <> target_organization_id then
    raise exception 'Accounting period does not belong to organization';
  end if;

  if matched_period.status = 'closed' then
    raise exception 'Accounting period is closed';
  end if;

  if matched_period.status = 'locked' then
    raise exception 'Accounting period is locked';
  end if;

  if matched_period.status <> 'open' then
    raise exception 'Accounting period is not open';
  end if;

  if input_entry_date < matched_period.start_date
    or input_entry_date > matched_period.end_date then
    raise exception 'Entry date is outside the selected accounting period';
  end if;

  line_index := 0;

  for line_item in
    select value
    from jsonb_array_elements(input_lines)
  loop
    line_index := line_index + 1;

    if line_item ? 'account_id' is false
      or nullif(btrim(line_item ->> 'account_id'), '') is null then
      raise exception 'Each journal line requires an account';
    end if;

    begin
      line_account_id := (line_item ->> 'account_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Each journal line requires a valid account';
    end;

    line_description := nullif(btrim(coalesce(line_item ->> 'description', '')), '');

    if line_item ? 'fund_id'
      and nullif(btrim(line_item ->> 'fund_id'), '') is not null then
      begin
        line_fund_id := (line_item ->> 'fund_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Fund must be a valid identifier when provided';
      end;
    else
      line_fund_id := null;
    end if;

    if line_item ? 'debit' is false or line_item ? 'credit' is false then
      raise exception 'Each line must have either a debit or a credit';
    end if;

    begin
      line_debit := coalesce((line_item ->> 'debit')::numeric(18,2), 0);
      line_credit := coalesce((line_item ->> 'credit')::numeric(18,2), 0);
    exception
      when invalid_text_representation then
        raise exception 'Line amounts must be valid numbers';
    end;

    if line_debit < 0 or line_credit < 0 then
      raise exception 'Line amounts must be nonnegative';
    end if;

    if line_debit > 0 and line_credit > 0 then
      raise exception 'Each line cannot have both debit and credit';
    end if;

    if line_debit = 0 and line_credit = 0 then
      raise exception 'Each line must have a positive debit or credit amount';
    end if;

    if not exists (
      select 1
      from public.accounts account_row
      where account_row.id = line_account_id
        and account_row.organization_id = target_organization_id
    ) then
      raise exception 'Account does not belong to organization';
    end if;

    if exists (
      select 1
      from public.accounts account_row
      where account_row.id = line_account_id
        and (
          account_row.organization_id <> target_organization_id
          or account_row.status <> 'active'
          or account_row.is_posting is not true
        )
    ) then
      raise exception 'Account must be active and posting-enabled';
    end if;

    if line_fund_id is not null then
      if not exists (
        select 1
        from public.funds fund_row
        where fund_row.id = line_fund_id
          and fund_row.organization_id = target_organization_id
      ) then
        raise exception 'Fund does not belong to organization';
      end if;

      if exists (
        select 1
        from public.funds fund_row
        where fund_row.id = line_fund_id
          and (
            fund_row.organization_id <> target_organization_id
            or fund_row.status <> 'active'
          )
      ) then
        raise exception 'Fund must be active';
      end if;
    end if;

    total_debits := total_debits + line_debit;
    total_credits := total_credits + line_credit;
  end loop;

  if total_debits <> total_credits then
    raise exception 'Journal entry is not balanced';
  end if;

  if total_debits <= 0 then
    raise exception 'Journal entry total must be greater than zero';
  end if;

  created_journal_entry_id := gen_random_uuid();
  generated_entry_number := format(
    'MAN-%s',
    upper(replace(created_journal_entry_id::text, '-', ''))
  );

  insert into public.journal_entries (
    id,
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
    created_journal_entry_id,
    target_organization_id,
    matched_period.id,
    generated_entry_number,
    input_entry_date,
    btrim(input_description),
    'manual',
    null,
    'posted'
  )
  returning *
  into created_journal_entry;

  line_index := 0;

  for line_item in
    select value
    from jsonb_array_elements(input_lines)
  loop
    line_index := line_index + 1;
    line_account_id := (line_item ->> 'account_id')::uuid;
    line_description := nullif(btrim(coalesce(line_item ->> 'description', '')), '');

    if line_item ? 'fund_id'
      and nullif(btrim(line_item ->> 'fund_id'), '') is not null then
      line_fund_id := (line_item ->> 'fund_id')::uuid;
    else
      line_fund_id := null;
    end if;

    line_debit := coalesce((line_item ->> 'debit')::numeric(18,2), 0);
    line_credit := coalesce((line_item ->> 'credit')::numeric(18,2), 0);

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
      line_account_id,
      line_fund_id,
      line_index,
      line_description,
      line_debit,
      line_credit
    );
  end loop;

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
    'manual_journal.recorded',
    'journal_entry',
    created_journal_entry_id,
    'user',
    auth.uid(),
    format(
      'Manual journal %s recorded (total %s)',
      generated_entry_number,
      total_debits
    ),
    now()
  );

  return created_journal_entry;
end;
$$;

comment on function public.record_manual_journal(uuid, date, text, uuid, jsonb) is
  'Records a balanced manual journal entry for staff+ members by inserting a posted manual-sourced journal header and lines atomically with one audit_events row. Entry numbers are derived deterministically from the generated journal ID (MAN-{compact-uuid}). SECURITY DEFINER is the narrow authenticated write boundary; editing, reversal, and voiding are separate workflows.';

revoke all on function public.record_manual_journal(uuid, date, text, uuid, jsonb) from public;
revoke execute on function public.record_manual_journal(uuid, date, text, uuid, jsonb) from anon;
grant execute on function public.record_manual_journal(uuid, date, text, uuid, jsonb) to authenticated;
