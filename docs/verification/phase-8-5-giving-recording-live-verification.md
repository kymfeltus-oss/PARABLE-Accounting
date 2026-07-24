# Phase 8.5 — Giving Journal Recording Live Verification

Live Supabase verification record for the giving journal recording workflow (`record_giving` RPC). Use **base tables only**:

- `public.giving_transactions`
- `public.journal_entries`
- `public.journal_entry_lines`
- `public.audit_events`

Do **not** reference views.

## Migrations applied

1. `supabase/migrations/20260729103000_add_giving_journal_linkage.sql` — `giving_transactions.journal_entry_id` FK and duplicate-posting index
2. `supabase/migrations/20260729113000_record_giving.sql` — atomic `record_giving` SECURITY DEFINER RPC

## RPC signature

```sql
public.record_giving(
  target_organization_id uuid,
  target_giving_transaction_id uuid,
  input_debit_account_id uuid,
  input_credit_account_id uuid
) returns public.giving_transactions
```

## Candidate fixture IDs (validate before use)

| Item | Candidate |
|------|-----------|
| Development organization | `25ecab7b-ccda-4bc1-b20f-99106a19119a` |
| Owner user | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Viewer user | `82a61594-7ff6-449e-954c-3cccc5307889` |
| Open period | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` (2026-07-01..2026-07-31) |
| Asset debit account | Discover active posting asset account |
| Revenue credit account | Discover active posting revenue account |
| Fund | `966522d9-8fe4-497b-b5a6-8cb449f2372e` |
| Recorded giving transaction (no journal) | Discover or insert test row |

Do not guess replacements. Discover first if any candidate is invalid.

## Live results (fill after execution)

### Positive owner recording

| Field | Value |
|-------|-------|
| Giving transaction ID | |
| Journal entry ID | |
| Entry number | |
| Debit line count | 1 |
| Credit line count | 1 |
| Total debit | |
| Total credit | |
| Balanced | true |
| `giving_transactions.journal_entry_id` set | true |
| Audit event ID | |

### Negative paths

Each case must show no partial journal rows for that attempt.

| # | Scenario | Expected error | Verified |
|---|----------|----------------|----------|
| 1 | Viewer role | Insufficient role to record giving | |
| 2 | Unauthenticated | Authenticated user is required | |
| 3 | Void giving | Giving transaction is not in recorded status | |
| 4 | Already linked | Giving transaction is already linked to a journal entry | |
| 5 | Closed period | Accounting period is closed | |
| 6 | Wrong debit type (cash + liability) | Debit account must be an asset account for cash giving method | |
| 7 | Non-revenue credit | Credit account must be a revenue account | |
| 8 | Cross-org account | Debit/Credit account does not belong to organization | |
| 9 | Duplicate call | Giving transaction already has a recorded journal entry | |

### Cleanup

Remove test giving transactions and linked journals created solely for verification when finished.
