# Phase 8.5A — Journal Voiding (Locked Plan)

## Status & labels
- DB / app status: `void` (not `voided`)
- Badge label: `VOID`
- UI actions: `Reverse Journal`, `Void Journal`
- Audit event: `journal.voided`

## RPC
```sql
public.void_journal_entry(
  target_organization_id uuid,
  target_journal_entry_id uuid,
  input_reason text
) returns public.journal_entries
```
No reversal date, accounting period, or posting date.

## Persistence
- Column `void_reason text` on `journal_entries` (required when status = void)

## Eligibility
- `status = 'posted'`
- `source_type IN ('manual','adjustment')`
- not already `void`
- not already `reversed`
- not a reversal journal
- no reversal child
- org-scoped
- caller `owner` / `accountant` / `staff`

## Reporting
- Register: void journals remain searchable / filterable / auditable
- Default financial reports: only `status = 'posted'` (excludes `void`)

## Implemented surface
1. Migration `20260730103000_void_journal_entry.sql` + migration tests
2. `journal-void-repository.ts` (+ eligibility) and status union updates
3. `voidJournalEntryAction`
4. Detail UI (`JournalVoidSection` / `JournalVoidForm`) + register VOID badge/filter
5. Report exclusion via posted-only journal aggregation
6. Unit tests across migration / repo / actions / UI / page wiring
