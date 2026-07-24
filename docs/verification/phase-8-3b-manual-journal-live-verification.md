# Phase 8.3B — Manual Journal Backend Live Verification

Live Supabase verification record for the manual journal recording workflow (`record_manual_journal` RPC). This document records verified facts from the development environment only.

## Environment

| Item | Value |
|------|-------|
| Development organization | `25ecab7b-ccda-4bc1-b20f-99106a19119a` |
| Authenticated owner | `32275b8f-2329-4be3-8cda-beb8066061ca` |
| Open accounting period | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` |

## Migration verified live

The following migration was applied and verified in the live development database:

1. `supabase/migrations/20260727103000_record_manual_journal.sql` — atomic `record_manual_journal` SECURITY DEFINER RPC

## Positive owner recording

### Journal

| Field | Value |
|-------|-------|
| ID | `2bb4f049-1e95-40f0-9f52-45eb7bfa2dfe` |
| Entry number | `MAN-2BB4F0491E9540F09F5245EB7BFA2DFE` |
| Entry date | 2026-07-15 |
| Description | `PHASE-8-3B LIVE VERIFICATION` |
| Source type | `manual` |
| Status | `posted` |
| Accounting period | `cf76e126-707d-42be-8c39-d0a63d4ac9e4` |
| Line count | 2 |
| Total debit | 125.00 |
| Total credit | 125.00 |
| Balanced | true |

### Journal lines verified

| # | Side | Amount | Account | Fund |
|---|------|--------|---------|------|
| 1 | Debit | 125.00 | `c00996d2-8ec3-4ed0-8a75-11145b45428e` (6100 — Phase 5I Office Supplies) | `966522d9-8fe4-497b-b5a6-8cb449f2372e` |
| 2 | Credit | 125.00 | `3927e138-8aa5-46f5-a517-2dad29d68a83` (2100 — Phase 6 Credit Card Payable) | `966522d9-8fe4-497b-b5a6-8cb449f2372e` |

### Audit event verified

| Field | Value |
|-------|-------|
| ID | `c130535f-d9cb-4f3b-a36e-3cdd20800735` |
| event_type | `manual_journal.recorded` |
| source_type | `journal_entry` |
| actor_type | `user` |
| actor_user_id | `32275b8f-2329-4be3-8cda-beb8066061ca` |

### Post-recording invariants verified

- Exactly one journal header was created for the positive path.
- Exactly two journal lines were created.
- Debit and credit totals both equal 125.00 and are balanced.
- `source_type = manual` and `status = posted`.
- Exactly one `manual_journal.recorded` audit event exists for the journal, attributed to the owner user.

## Negative-path verification

Each negative path was verified live. For every case below, counts after the failed call were:

| Metric | Result |
|--------|--------|
| `failed_journal_count` | 0 |
| `failed_line_count` | 0 |
| `failed_audit_count` | 0 |

| # | Scenario | Result |
|---|----------|--------|
| 1 | Insufficient viewer role | Rejected; zero journal/lines/audit rows |
| 2 | Closed accounting period | Rejected; zero journal/lines/audit rows |
| 3 | Entry date outside selected period | Rejected; zero journal/lines/audit rows |
| 4 | Cross-organization account | Rejected; zero journal/lines/audit rows |
| 5 | Active but non-posting account | Rejected; zero journal/lines/audit rows |
| 6 | Cross-organization fund | Rejected; zero journal/lines/audit rows |
| 7 | Unbalanced journal | Rejected; zero journal/lines/audit rows |
| 8 | Zero-value journal | Rejected; zero journal/lines/audit rows |
| 9 | Fewer than two journal lines | Rejected; zero journal/lines/audit rows |

### Temporary fixtures used for negative paths

| Fixture | ID |
|---------|----|
| Closed accounting period | `8f0d2c53-0e14-4d63-bf87-03c2de2f9a31` |
| Non-posting account | `7e2b05aa-8d67-4f1d-9310-a3cb5f7a6041` |

## Cleanup

The following temporary verification data was removed successfully after verification:

- Successful verification journal `2bb4f049-1e95-40f0-9f52-45eb7bfa2dfe`
- Successful verification journal lines
- Successful verification audit event `c130535f-d9cb-4f3b-a36e-3cdd20800735`
- Temporary closed period `8f0d2c53-0e14-4d63-bf87-03c2de2f9a31`
- Temporary non-posting account `7e2b05aa-8d67-4f1d-9310-a3cb5f7a6041`

Cleanup verification returned zero for all five checks.

## Scope statement

The listed positive recording path, nine negative authorization/validation denials, zero-row failure atomicity, and scoped cleanup were verified live in the development environment. Editing, reversal, voiding, and concurrent recording under load were not part of this verification record.

## Verification checklist

- [x] Migration applied in Supabase
- [x] Positive owner path creates posted manual journal + lines + audit event
- [x] Viewer path rejected
- [x] Closed period rejected
- [x] Date outside period rejected
- [x] Cross-org account rejected
- [x] Active but non-posting account rejected
- [x] Cross-org fund rejected
- [x] Unbalanced journal rejected
- [x] Zero-value journal rejected
- [x] Fewer-than-two-lines rejected
- [x] Failed paths create no journal, lines, or audit rows
- [x] Cleanup completed
