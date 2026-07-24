# Phase 8.5A — Journal Void Live Verification

Live Supabase verification record for `public.void_journal_entry`. Use **base tables only**:

- `public.journal_entries`
- `public.journal_entry_lines`
- `public.audit_events`

Do **not** reference `journal_entry_lines_view` or any other views.

## Authenticated RPC execution (required)

**Supabase SQL Editor cannot provide an authenticated JWT.** Confirmed previously:

```sql
select auth.uid(), auth.jwt();
-- auth.uid = NULL, auth.jwt = NULL
```

SECURITY DEFINER RPCs correctly fail in SQL Editor with `Authenticated user is required`.

Do **not** remove auth checks, bypass RLS, change `SECURITY DEFINER`, change migrations, or change function signatures to work around this.

**Authenticated RPC execution must occur through the application** (signed-in owner session), not the SQL Editor.

Use the shipped journal UI:

- Create: `/accounting/journals/new` → `record_manual_journal`
- Void: `/accounting/journals/[id]` → `void_journal_entry` (**Void Journal**)

Continue using **SQL Editor / table reads only** for:

- `journal_entries` verification
- `journal_entry_lines` verification
- `audit_events` verification
- cleanup verification

## Migration applied

`supabase/migrations/20260730103000_void_journal_entry.sql`

Verified present on development database:

- status constraint includes `'void'`
- column `void_reason`
- function `public.void_journal_entry(uuid, uuid, text)`
- unauthenticated probe returns `Authenticated user is required`

## RPC signature

```sql
public.void_journal_entry(
  target_organization_id uuid,
  target_journal_entry_id uuid,
  input_reason text
) returns public.journal_entries
```

## Candidate fixture IDs

| Item | Candidate |
|------|-----------|
| Development organization | `25ecab7b-ccda-4bc1-b20f-99106a19119a` |
| Owner user | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Open period | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` |
| Debit account (6100) | `c00996d2-8ec3-4ed0-8a75-11145b45428e` |
| Credit account (2100) | `3927e138-8aa5-46f5-a517-2dad29d68a83` |
| Fund | `966522d9-8fe4-497b-b5a6-8cb449f2372e` |

Fixture payload:

- Description: `PHASE-8-5A LIVE VERIFICATION`
- Entry date: `2026-07-15`
- Amount: `125.00`
- Void reason: `Phase 8.5A live verification void`

## Live results (authenticated owner JWT)

Executed 2026-07-24. Actor `auth.uid() = 32275b8f-2329-4be3-8cda-beb8066061ca`.

| Field | Value |
|-------|-------|
| Journal ID | `8b4bf31b-b4bc-4232-b407-896c0a8a8a1b` |
| Entry number | `MAN-8B4BF31BB4BC4232B407896C0A8A8A1B` |
| Status after void | `void` |
| Source type | `manual` |
| Void reason | `Phase 8.5A live verification void` |
| Audit event ID | `5cc1df4e-dc13-4663-b575-0230af4f771b` |
| Audit event type | `journal.voided` |
| Audit actor | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Reversal children created | `0` (status-only void) |

### Post-void invariants

- [x] Original `status = void`
- [x] `void_reason` persisted on journal header
- [x] No offsetting / reversal journal created
- [x] Lines unchanged (125 Dr / 125 Cr)
- [x] Exactly one `journal.voided` audit event on the journal, attributed to owner

### Cleanup

- [x] Verification journal + lines + audit removed
- [x] Remaining marker count = 0 for `PHASE-8-5A LIVE VERIFICATION` / void reason

## Verification checklist

- [x] Migration applied on development database
- [x] Authenticated positive void path complete
- [x] Table verification recorded
- [x] Cleanup complete
- [ ] Negative paths (optional / separate session)

## Scope statement

Positive owner void path, schema alignment (`void` status + `void_reason`), audit attribution, no reversal-child side effect, and post-verification cleanup were verified live. Negative authorization/validation paths were not re-run in this session.
