# Phase 8.4 — Journal Reversal Live Verification

Live Supabase verification record for `public.reverse_journal_entry`. Use **base tables only**:

- `public.journal_entries`
- `public.journal_entry_lines`
- `public.audit_events`

Do **not** reference `journal_entry_lines_view` or any other views.

## Authenticated RPC execution (required)

**Supabase SQL Editor cannot provide an authenticated JWT.** Confirmed:

```sql
select auth.uid(), auth.jwt();
-- auth.uid = NULL, auth.jwt = NULL
```

Therefore SECURITY DEFINER RPCs correctly fail in SQL Editor with:

```text
Authenticated user is required
```

Do **not** remove auth checks, bypass RLS, change `SECURITY DEFINER`, change migrations, or change function signatures to work around this.

**Authenticated RPC execution must occur through the application** (signed-in owner session), not the SQL Editor.

Use the shipped journal UI:

- Create: `/accounting/journals/new` → `record_manual_journal`
- Reverse: `/accounting/journals/[id]` → `reverse_journal_entry`

Continue using **SQL Editor only** for:

- `journal_entries` verification
- `journal_entry_lines` verification
- `audit_events` verification
- cleanup verification

Temporary one-off verification helpers (dev route / CLI script) were used for this live run and then removed so they do not ship.

## How to run

1. Sign in to the app as the owner user for the development organization.
2. Create the fixture journal via `/accounting/journals/new` (description `PHASE-8-4 LIVE VERIFICATION`, fixture period/accounts/fund/amount below).
3. Reverse it via the journal detail page (reason `Phase 8.4 live verification reversal`).
4. Copy original / reversal IDs and entry numbers into the tables below.
5. In SQL Editor, run the read-only verification selects (below). Do **not** call the RPCs from SQL Editor.
6. After recording results, run cleanup selects/deletes in SQL Editor and confirm zero marker rows.

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

App fixture payload (matches the verification page):

- Description: `PHASE-8-4 LIVE VERIFICATION`
- Entry date: `2026-07-15`
- Reversal date: `2026-07-20`
- Reversal reason: `Phase 8.4 live verification reversal`
- Amount: `125.00` (debit 6100 / credit 2100, same fund)

## SQL Editor verification queries (read-only)

```sql
-- Headers
SELECT
  o.id AS original_journal_id,
  o.entry_number AS original_entry_number,
  o.status AS original_status,
  r.id AS reversal_journal_id,
  r.entry_number AS reversal_entry_number,
  r.source_type AS reversal_source_type,
  r.reverses_journal_entry_id,
  r.reversal_reason,
  r.status AS reversal_status
FROM public.journal_entries o
JOIN public.journal_entries r ON r.reverses_journal_entry_id = o.id
WHERE o.description = 'PHASE-8-4 LIVE VERIFICATION';

-- Lines (original + reversal)
SELECT
  je.entry_number,
  jel.line_number,
  jel.account_id,
  jel.fund_id,
  jel.debit_amount,
  jel.credit_amount
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
WHERE je.description = 'PHASE-8-4 LIVE VERIFICATION'
   OR je.reverses_journal_entry_id IN (
        SELECT id FROM public.journal_entries
        WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
      )
ORDER BY je.entry_number, jel.line_number;

-- Audit
SELECT
  ae.id AS audit_event_id,
  ae.event_type,
  ae.actor_user_id,
  ae.description,
  ae.source_id
FROM public.audit_events ae
JOIN public.journal_entries o ON o.id = ae.source_id
WHERE o.description = 'PHASE-8-4 LIVE VERIFICATION'
  AND ae.event_type = 'journal.reversed'
ORDER BY ae.occurred_at DESC;
```

## Live results (authenticated app / owner JWT execution)

Executed 2026-07-24 via authenticated owner session (`auth.uid() = 32275b8f-2329-4be3-8cda-beb8066061ca`). RPCs were **not** invoked from SQL Editor.

### Positive original / reversal

| Field | Value |
|-------|-------|
| Original journal ID | `7ef2e50c-6842-4d91-8655-a8a988bcf57f` |
| Original entry number | `MAN-7EF2E50C68424D918655A8A988BCF57F` |
| Original status | `reversed` |
| Reversal journal ID | `04aef0f9-e5ea-47be-9720-22ba57f570ad` |
| Reversal entry number | `REV-04AEF0F9E5EA47BE972022BA57F570AD` |
| Reversal source type | `reversal` |
| Reversal reason | `Phase 8.4 live verification reversal` |
| Reversal status | `posted` |
| Audit event ID | `0108226b-ea73-4ce2-84e5-8e5e06f9d493` |
| Audit actor | `32275b8f-2329-4be3-8cda-beb8066061ca` |

### Post-reversal invariants

- [x] Original `status = reversed`
- [x] Reversal `source_type = reversal`, `status = posted`
- [x] Reversal `reverses_journal_entry_id` points to original
- [x] Reversal reason recorded on reversal header
- [x] Exactly one `journal.reversed` audit event on the original, attributed to owner

### Negative paths

Each case must show `failed_journal_count = 0`, `failed_line_count = 0`, `failed_audit_count = 0` for that attempt (no new rows vs count before call).

Negative RPC attempts also require an authenticated application session (or a test harness that supplies a JWT). SQL Editor cannot be used to invoke them.

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

### Cleanup (SQL Editor)

```sql
-- Inspect markers first
SELECT id, entry_number, description, status, source_type
FROM public.journal_entries
WHERE description ILIKE '%PHASE-8-4%'
   OR description LIKE 'Reversal of MAN-%';

-- Then delete lines → audit → headers for the verification markers
DELETE FROM public.journal_entry_lines
WHERE journal_entry_id IN (
  SELECT id FROM public.journal_entries
  WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
     OR reverses_journal_entry_id IN (
          SELECT id FROM public.journal_entries
          WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
        )
);

DELETE FROM public.audit_events
WHERE source_id IN (
  SELECT id FROM public.journal_entries
  WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
)
  AND event_type = 'journal.reversed';

DELETE FROM public.journal_entries
WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
   OR reverses_journal_entry_id IN (
        SELECT id FROM public.journal_entries
        WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
      );
-- If FK order requires deleting reversal first:
-- DELETE reversal rows (source_type = 'reversal') then original.

-- Confirm cleanup
SELECT COUNT(*) AS remaining_markers
FROM public.journal_entries
WHERE description = 'PHASE-8-4 LIVE VERIFICATION'
   OR reversal_reason = 'Phase 8.4 live verification reversal';
```

- [x] Verification original + reversal + lines + audit removed / restored as planned
- [x] Cleanup counts all zero for Phase 8.4 markers

## Verification checklist

- [x] Authenticated positive path (owner JWT; not SQL Editor RPCs)
- [x] Base-table verification recorded (`journal_entries`, `journal_entry_lines`, `audit_events`)
- [x] Positive-path cleanup complete (remaining marker count = 0)
- [ ] Negative paths (12 scenarios) — optional / separate session
