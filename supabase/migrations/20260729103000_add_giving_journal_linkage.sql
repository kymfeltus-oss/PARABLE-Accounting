-- Giving-to-journal linkage for record_giving RPC.
-- Schema-only: additive columns and indexes; no backfill, RPC, or RLS changes.

alter table public.giving_transactions
  add column journal_entry_id uuid null;

alter table public.giving_transactions
  add constraint giving_transactions_journal_entry_id_fkey
    foreign key (journal_entry_id)
    references public.journal_entries(id)
    on delete restrict;

comment on column public.giving_transactions.journal_entry_id is
  'Posted journal entry generated when the giving transaction is recorded to the ledger. NULL for operational giving not yet posted.';

create unique index journal_entries_giving_source_unique
  on public.journal_entries (
    organization_id,
    source_id
  )
  where source_type = 'giving'
    and source_id is not null;

comment on index public.journal_entries_giving_source_unique is
  'Prevents more than one giving-sourced journal per organization and source document.';

create index giving_transactions_journal_entry_id_idx
  on public.giving_transactions (journal_entry_id);
