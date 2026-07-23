# Phase 6 — Expense Recording Live Verification

Live Supabase verification record for the expense-recording workflow (`record_expense` RPC and supporting schema). This document records verified facts from the development environment only. It does not assert that all possible expense-recording scenarios have been tested.

## Environment

| Item | Value |
|------|-------|
| Development organization | `25ecab7b-ccda-4bc1-b20f-99106a19119a` |
| Isolation organization | `0650183f-5f0a-4ada-a045-ddb8b078b1f6` |
| Owner user | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Viewer user | `82a61594-7ff6-449e-954c-3cccc5307889` |

### Open accounting period

| Field | Value |
|-------|-------|
| ID | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` |
| Name | Phase 6 July 2026 |
| Dates | 2026-07-01 through 2026-07-31 |
| Status | open |

## Migrations verified live

The following migrations were applied and verified in the live development database:

1. `20260724103000_add_expense_journal_linkage.sql` — expense-to-journal linkage columns and partial unique index
2. `20260725103000_record_expense.sql` — atomic `record_expense` SECURITY DEFINER RPC
3. `20260726103000_fix_record_expense_alias_collision.sql` — corrective `CREATE OR REPLACE FUNCTION`

The corrective migration resolved a PL/pgSQL record-variable and SQL-alias collision (`expense_line record` shadowing the `expense_line` table alias) that caused runtime error `55000: record "expense_line" is not assigned yet`. The fix renamed loop record variables and SQL aliases without changing intended accounting behavior, validations, journal structure, or grants.

## Positive owner recording

### Expense

| Field | Value |
|-------|-------|
| ID | `ece25eb0-794e-407e-a63e-f19b4d184ebc` |
| Reference | PHASE-5B-OWNER-TEST |
| Total | $125.00 |
| Final status | recorded |

### Created journal

| Field | Value |
|-------|-------|
| ID | `56c56f3e-9fa1-4d3b-9891-26b0af184543` |
| Number | EXP-ECE25EB0794E407EA63EF19B4D184EBC |
| Entry date | 2026-07-23 |
| Status | posted |
| Source type | expense |
| Source ID | `ece25eb0-794e-407e-a63e-f19b4d184ebc` |
| Accounting period | Phase 6 July 2026 |

### Journal lines verified

| # | Side | Account | Fund | Amount |
|---|------|---------|------|--------|
| 1 | Debit | 6100 | GEN-P5I | $75.25 |
| 2 | Debit | 6200 | — | $49.75 |
| 3 | Credit | 2100 | GEN-P5I | $75.25 |
| 4 | Credit | 2100 | — | $49.75 |

### Post-recording invariants verified

- Total debits equal total credits ($125.00).
- Each fund bucket balances independently (GEN-P5I: $75.25 debits = $75.25 credits; unrestricted bucket: $49.75 debits = $49.75 credits).
- The expense links to exactly one journal entry.
- Exactly one `expense.recorded` audit event exists for this expense.
- The audit event actor is the owner user (`32275b8f-2329-4be3-8cda-beb8066061ca`).

## Authorization and idempotency tests

The following paths were verified live against the development database:

| # | Scenario | Fixture / context | Expected error | Received |
|---|----------|-------------------|----------------|----------|
| 1 | Duplicate owner recording attempt | Recorded expense `ece25eb0-794e-407e-a63e-f19b4d184ebc` | Expense is not in draft status | Expense is not in draft status |
| 2 | Viewer recording attempt | Viewer user `82a61594-7ff6-449e-954c-3cccc5307889` | Insufficient role to record expense | Insufficient role to record expense |
| 3 | Closed accounting period | `P6F-CLOSED-NEG` | Accounting period is closed | Accounting period is closed |
| 4 | Cross-organization credit account | `P6G-CROSSORG-NEG` | Credit account does not belong to organization | Credit account does not belong to organization |
| 5 | Invalid credit account type | `P6H-INVALIDTYPE-NEG` | Credit account type is not allowed | Credit account type is not allowed |

## Failed-write integrity verification

For all three negative-path fixture expenses, verified before cleanup:

| Reference | Status | `journal_entry_id` | Expense-source journals | `expense.recorded` audit events |
|-----------|--------|--------------------|-------------------------|----------------------------------|
| P6F-CLOSED-NEG | draft | null | 0 | 0 |
| P6G-CROSSORG-NEG | draft | null | 0 | 0 |
| P6H-INVALIDTYPE-NEG | draft | null | 0 | 0 |

No journal lines, status changes, or audit events were created on any failed `record_expense` invocation.

## Cleanup

The following temporary fixtures were removed successfully after verification:

- Expense reference: `P6F-CLOSED-NEG`
- Expense reference: `P6G-CROSSORG-NEG`
- Expense reference: `P6H-INVALIDTYPE-NEG`
- Accounting period name: `P6F-CLOSED-PERIOD`

Post-cleanup verification queries for these references and period name returned no rows.

## Scope statement

The listed positive recording path, authorization denial, duplicate-post idempotency, closed-period denial, cross-organization credit-account denial, and invalid credit-account-type denial were verified live in the development environment. Additional scenarios (for example voiding, reversal, closed-fund edge cases, or concurrent recording under load) were not part of this verification record.
