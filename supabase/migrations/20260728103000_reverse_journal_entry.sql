-- Phase 8.4: journal reversal linkage columns and reverse_journal_entry RPC.
-- Original journal lines/description/entry_number remain immutable.
-- Original status transitions to 'reversed'; one reversal per original is enforced.

alter table public.journal_entries
  drop constraint journal_entries_source_type_valid;

alter table public.journal_entries
  add constraint journal_entries_source_type_valid
  check (
    source_type in (
      'manual',
      'giving',
      'banking',
      'expense',
      'bill',
      'adjustment',
      'closing',
      'reversal'
    )
  );

alter table public.journal_entries
  add column reverses_journal_entry_id uuid null,
  add column reversal_reason text null;

alter table public.journal_entries
  add constraint journal_entries_reverses_journal_entry_id_fkey
  foreign key (reverses_journal_entry_id)
  references public.journal_entries(id)
  on delete restrict;

alter table public.journal_entries
  add constraint journal_entries_reversal_reason_not_blank
  check (
    reversal_reason is null
    or char_length(btrim(reversal_reason)) > 0
  );

alter table public.journal_entries
  add constraint journal_entries_reversal_reason_max_length
  check (
    reversal_reason is null
    or char_length(reversal_reason) <= 500
  );

alter table public.journal_entries
  add constraint journal_entries_reversal_fields_consistent
  check (
    (
      source_type = 'reversal'
      and reverses_journal_entry_id is not null
      and reversal_reason is not null
    )
    or (
      source_type <> 'reversal'
      and reverses_journal_entry_id is null
      and reversal_reason is null
    )
  );

create unique index journal_entries_one_reversal_per_original_uidx
  on public.journal_entries (reverses_journal_entry_id)
  where reverses_journal_entry_id is not null;

create index journal_entries_reverses_journal_entry_id_idx
  on public.journal_entries (organization_id, reverses_journal_entry_id)
  where reverses_journal_entry_id is not null;

comment on column public.journal_entries.reverses_journal_entry_id is
  'When set, this journal is the reversing entry for the referenced original journal. Unique across non-null values so an original may be reversed only once.';

comment on column public.journal_entries.reversal_reason is
  'Required nonempty reason when source_type = reversal; null otherwise.';

create or replace function public.reverse_journal_entry(
  target_organization_id uuid,
  target_journal_entry_id uuid,
  input_reversal_date date,
  input_period_id uuid,
  input_reason text
)
returns public.journal_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_journal public.journal_entries;
  matched_period public.accounting_periods;
  existing_reversal_id uuid;
  created_reversal public.journal_entries;
  created_reversal_id uuid;
  generated_entry_number text;
  trimmed_reason text;
  original_line public.journal_entry_lines;
  line_count integer := 0;
  total_debits numeric(18,2) := 0;
  total_credits numeric(18,2) := 0;
begin
  if auth.uid() is null then
    raise exception 'Authenticated user is required';
  end if;

  if target_organization_id is null then
    raise exception 'Organization is required';
  end if;

  if target_journal_entry_id is null then
    raise exception 'Journal entry is required';
  end if;

  if input_reversal_date is null then
    raise exception 'Reversal date is required';
  end if;

  if input_period_id is null then
    raise exception 'Accounting period is required';
  end if;

  trimmed_reason := nullif(btrim(coalesce(input_reason, '')), '');

  if trimmed_reason is null then
    raise exception 'Reversal reason is required';
  end if;

  if char_length(trimmed_reason) > 500 then
    raise exception 'Reversal reason must be 500 characters or fewer';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to reverse journal entry';
  end if;

  select *
  into original_journal
  from public.journal_entries journal_row
  where journal_row.id = target_journal_entry_id
  for update;

  if not found then
    raise exception 'Journal entry not found';
  end if;

  if original_journal.organization_id <> target_organization_id then
    raise exception 'Journal entry does not belong to organization';
  end if;

  if original_journal.source_type = 'reversal' then
    raise exception 'Reversal journal cannot be reversed';
  end if;

  if original_journal.reverses_journal_entry_id is not null then
    raise exception 'Reversal journal cannot be reversed';
  end if;

  if original_journal.source_type not in ('manual', 'adjustment') then
    raise exception 'Journal source type cannot be reversed';
  end if;

  if original_journal.status = 'reversed' then
    raise exception 'Journal entry has already been reversed';
  end if;

  if original_journal.status <> 'posted' then
    raise exception 'Only posted journal entries can be reversed';
  end if;

  select journal_row.id
  into existing_reversal_id
  from public.journal_entries journal_row
  where journal_row.reverses_journal_entry_id = original_journal.id
  limit 1;

  if existing_reversal_id is not null then
    raise exception 'Journal entry has already been reversed';
  end if;

  select *
  into matched_period
  from public.accounting_periods period_row
  where period_row.id = input_period_id;

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

  if input_reversal_date < matched_period.start_date
    or input_reversal_date > matched_period.end_date then
    raise exception 'Reversal date is outside the selected accounting period';
  end if;

  for original_line in
    select *
    from public.journal_entry_lines line_row
    where line_row.journal_entry_id = original_journal.id
    order by line_row.line_number
  loop
    line_count := line_count + 1;

    if not exists (
      select 1
      from public.accounts account_row
      where account_row.id = original_line.account_id
        and account_row.organization_id = target_organization_id
    ) then
      raise exception 'Original account does not belong to organization';
    end if;

    if original_line.fund_id is not null
      and not exists (
        select 1
        from public.funds fund_row
        where fund_row.id = original_line.fund_id
          and fund_row.organization_id = target_organization_id
      ) then
      raise exception 'Original fund does not belong to organization';
    end if;

    total_debits := total_debits + original_line.debit_amount;
    total_credits := total_credits + original_line.credit_amount;
  end loop;

  if line_count < 2 then
    raise exception 'Journal entry must have at least two lines to reverse';
  end if;

  if total_debits <> total_credits then
    raise exception 'Journal entry is not balanced';
  end if;

  if total_debits <= 0 then
    raise exception 'Journal entry total must be greater than zero';
  end if;

  created_reversal_id := gen_random_uuid();
  generated_entry_number := format(
    'REV-%s',
    upper(replace(created_reversal_id::text, '-', ''))
  );

  begin
    insert into public.journal_entries (
      id,
      organization_id,
      accounting_period_id,
      entry_number,
      entry_date,
      description,
      source_type,
      source_id,
      status,
      reverses_journal_entry_id,
      reversal_reason
    )
    values (
      created_reversal_id,
      target_organization_id,
      matched_period.id,
      generated_entry_number,
      input_reversal_date,
      format('Reversal of %s', original_journal.entry_number),
      'reversal',
      null,
      'posted',
      original_journal.id,
      trimmed_reason
    )
    returning *
    into created_reversal;
  exception
    when unique_violation then
      raise exception 'Journal entry has already been reversed';
  end;

  insert into public.journal_entry_lines (
    journal_entry_id,
    account_id,
    fund_id,
    line_number,
    description,
    debit_amount,
    credit_amount
  )
  select
    created_reversal_id,
    line_row.account_id,
    line_row.fund_id,
    line_row.line_number,
    line_row.description,
    line_row.credit_amount,
    line_row.debit_amount
  from public.journal_entry_lines line_row
  where line_row.journal_entry_id = original_journal.id
  order by line_row.line_number;

  update public.journal_entries
  set
    status = 'reversed',
    updated_at = now()
  where id = original_journal.id
    and organization_id = target_organization_id
    and status = 'posted';

  if not found then
    raise exception 'Journal entry has already been reversed';
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
    'journal.reversed',
    'journal_entry',
    original_journal.id,
    'user',
    auth.uid(),
    format(
      'Journal %s reversed by %s on %s in period %s (reason: %s)',
      original_journal.entry_number,
      generated_entry_number,
      input_reversal_date,
      matched_period.name,
      trimmed_reason
    ),
    now()
  );

  return created_reversal;
end;
$$;

comment on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) is
  'Creates a posted reversing journal for an eligible posted original (manual/adjustment), swapping debits and credits line-for-line, linking via reverses_journal_entry_id, marking the original status reversed, and writing one journal.reversed audit event. SECURITY DEFINER is the narrow authenticated write boundary; voiding and replacement remain separate workflows.';

revoke all on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) from public;
revoke execute on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) from anon;
grant execute on function public.reverse_journal_entry(uuid, uuid, date, uuid, text) to authenticated;
