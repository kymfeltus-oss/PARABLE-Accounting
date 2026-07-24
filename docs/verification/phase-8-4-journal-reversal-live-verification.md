# Phase 8.4 — Journal Reversal Live Verification

Live Supabase verification record for `public.reverse_journal_entry`. Use **base tables only**:

- `public.journal_entries`
- `public.journal_entry_lines`
- `public.audit_events`

Do **not** reference `journal_entry_lines_view` or any other views.

## Migration applied

`supabase/migrations/20260728103000_reverse_journal_entry.sql`

Verified present:

- columns `reverses_journal_entry_id`, `reversal_reason`
- function `public.reverse_journal_entry(uuid, uuid, date, uuid, text)`
- indexes `journal_entries_one_reversal_per_original_uidx`, `journal_entries_reverses_journal_entry_id_idx`
- no `journal_entry_lines_view`

## RPC signature

```sql
public.reverse_journal_entry(
  target_organization_id uuid,
  target_journal_entry_id uuid,
  input_reversal_date date,
  input_period_id uuid,
  input_reason text
) returns public.journal_entries
```

## Candidate fixture IDs (validate before use)

| Item | Candidate |
|------|-----------|
| Development organization | `25ecab7b-ccda-4bc1-b20f-99106a19119a` |
| Isolation organization | `0650183f-5f0a-4ada-a045-ddb8b078b1f6` |
| Owner user | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Viewer user | `82a61594-7ff6-449e-954c-3cccc5307889` |
| Open period | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` (2026-07-01..2026-07-31) |
| Debit account (6100) | `c00996d2-8ec3-4ed0-8a75-11145b45428e` |
| Credit account (2100) | `3927e138-8aa5-46f5-a517-2dad29d68a83` |
| Fund | `966522d9-8fe4-497b-b5a6-8cb449f2372e` |

Do not guess replacements. Discover first if any candidate is invalid.

## Live results (fill after execution)

### Positive original / reversal

| Field | Value |
|-------|-------|
| Original journal ID | |
| Original entry number | |
| Reversal journal ID | |
| Reversal entry number | |
| Audit event ID | |

### Negative paths

Each case must show `failed_journal_count = 0`, `failed_line_count = 0`, `failed_audit_count = 0` for that attempt.

| # | Scenario | Expected error | Verified |
|---|----------|----------------|----------|
| 1 | Viewer role | Insufficient role to reverse journal entry | |
| 2 | Unauthenticated | Authenticated user is required | |
| 3 | Non-posted journal | Only posted journal entries can be reversed | |
| 4 | Closed period | Accounting period is closed | |
| 5 | Date outside period | Reversal date is outside the selected accounting period | |
| 6 | Cross-org journal | Journal entry does not belong to organization | |
| 7 | Cross-org period | Accounting period does not belong to organization | |
| 8 | Blank reason | Reversal reason is required | |
| 9 | Ineligible source (expense) | Journal source type cannot be reversed | |
| 10 | Already reversed | Journal entry has already been reversed | |
| 11 | Reverse a reversal | Reversal journal cannot be reversed | |
| 12 | Duplicate reversal | Journal entry has already been reversed | |

### Cleanup

- [ ] Verification original + reversal + lines + audit removed / restored as planned
- [ ] Temporary closed period / draft fixtures removed
- [ ] Cleanup counts all zero for Phase 8.4 markers
