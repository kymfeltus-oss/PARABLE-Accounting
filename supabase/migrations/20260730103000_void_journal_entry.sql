-- Phase 8.5A: journal void status, void_reason column, and void_journal_entry RPC.
-- Status-only void (no offsetting journal). Reversal remains a separate workflow.

alter table public.journal_entries
  drop constraint journal_entries_status_valid;

alter table public.journal_entries
  add constraint journal_entries_status_valid
  check (
    status in (
      'draft',
      'posted',
      'reversed',
      'void'
    )
  );

alter table public.journal_entries
  add column void_reason text null;

alter table public.journal_entries
  add constraint journal_entries_void_reason_not_blank
  check (
    void_reason is null
    or char_length(btrim(void_reason)) > 0
  );

alter table public.journal_entries
  add constraint journal_entries_void_reason_max_length
  check (
    void_reason is null
    or char_length(void_reason) <= 500
  );

alter table public.journal_entries
  add constraint journal_entries_void_fields_consistent
  check (
    (
      status = 'void'
      and void_reason is not null
    )
    or (
      status <> 'void'
      and void_reason is null
    )
  );

comment on column public.journal_entries.void_reason is
  'Required nonempty reason when status = void; null otherwise.';

create or replace function public.void_journal_entry(
  target_organization_id uuid,
  target_journal_entry_id uuid,
  input_reason text
)
returns public.journal_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_journal public.journal_entries;
  existing_reversal_id uuid;
  trimmed_reason text;
  updated_journal public.journal_entries;
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

  trimmed_reason := nullif(btrim(coalesce(input_reason, '')), '');

  if trimmed_reason is null then
    raise exception 'Void reason is required';
  end if;

  if char_length(trimmed_reason) > 500 then
    raise exception 'Void reason must be 500 characters or fewer';
  end if;

  if not public.has_org_role(
    target_organization_id,
    array['owner', 'accountant', 'staff']
  ) then
    raise exception 'Insufficient role to void journal entry';
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
    raise exception 'Reversal journal cannot be voided';
  end if;

  if original_journal.reverses_journal_entry_id is not null then
    raise exception 'Reversal journal cannot be voided';
  end if;

  if original_journal.source_type not in ('manual', 'adjustment') then
    raise exception 'Journal source type cannot be voided';
  end if;

  if original_journal.status = 'void' then
    raise exception 'Journal entry has already been voided';
  end if;

  if original_journal.status = 'reversed' then
    raise exception 'Journal entry has already been reversed';
  end if;

  if original_journal.status <> 'posted' then
    raise exception 'Only posted journal entries can be voided';
  end if;

  select journal_row.id
  into existing_reversal_id
  from public.journal_entries journal_row
  where journal_row.reverses_journal_entry_id = original_journal.id
  limit 1;

  if existing_reversal_id is not null then
    raise exception 'Journal entry has already been reversed';
  end if;

  update public.journal_entries
  set
    status = 'void',
    void_reason = trimmed_reason,
    updated_at = now()
  where id = original_journal.id
    and organization_id = target_organization_id
    and status = 'posted'
  returning *
  into updated_journal;

  if not found then
    raise exception 'Journal entry has already been voided';
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
    'journal.voided',
    'journal_entry',
    original_journal.id,
    'user',
    auth.uid(),
    format(
      'Journal %s voided (reason: %s)',
      original_journal.entry_number,
      trimmed_reason
    ),
    now()
  );

  return updated_journal;
end;
$$;

comment on function public.void_journal_entry(uuid, uuid, text) is
  'Marks an eligible posted original journal (manual/adjustment) as void with a persisted void_reason, without creating an offsetting journal, and writes one journal.voided audit event. SECURITY DEFINER is the narrow authenticated write boundary; reversal remains a separate workflow.';

revoke all on function public.void_journal_entry(uuid, uuid, text) from public;
revoke execute on function public.void_journal_entry(uuid, uuid, text) from anon;
grant execute on function public.void_journal_entry(uuid, uuid, text) to authenticated;
