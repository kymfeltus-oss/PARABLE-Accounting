-- Expense-to-journal linkage for future record_expense RPC.
-- Schema-only: additive columns and indexes; no backfill, RPC, or RLS changes.

alter table public.journal_entries
  add column source_id uuid null;

comment on column public.journal_entries.source_id is
  'Polymorphic source-document identifier paired with source_type. For expense-sourced journals, references public.expenses.id. NULL for legacy and manual entries.';

alter table public.expenses
  add column journal_entry_id uuid null;

alter table public.expenses
  add constraint expenses_journal_entry_id_fkey
    foreign key (journal_entry_id)
    references public.journal_entries(id)
    on delete restrict;

comment on column public.expenses.journal_entry_id is
  'Posted journal entry generated when the expense is recorded. NULL for draft and legacy expenses.';

create unique index journal_entries_expense_source_unique
  on public.journal_entries (
    organization_id,
    source_id
  )
  where source_type = 'expense'
    and source_id is not null;

comment on index public.journal_entries_expense_source_unique is
  'Prevents more than one expense-sourced journal per organization and source document.';

create index journal_entries_source_lookup
  on public.journal_entries (
    organization_id,
    source_type,
    source_id
  );

create index expenses_journal_entry_id_idx
  on public.expenses (journal_entry_id);
