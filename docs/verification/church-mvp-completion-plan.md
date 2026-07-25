# Church MVP Completion Plan — Status

Branch: `phase-9-church-mvp`  
Target: Church MVP go-live (Finish line A)  
**Status: Complete** (2026-07-25) — see `church-mvp-production-smoke.md`

## Locked decisions (no email provider required)
- Org bootstrap via `create_organization` seeds COA, General Fund, open period, bank account, settings
- Invites use app-generated token + stored sha256 hash
- Multi-org selection via httpOnly cookie `parable_active_organization_id`
- Writes remain SECURITY DEFINER RPC only

## Implemented phases

| Phase | Status | Notes |
|-------|--------|-------|
| 9 Platform | Done | Org create, invites, settings, org switch |
| 10 Master data | Done | Funds, members, accounts, periods |
| 11 Giving + Bills | Done | Create giving, create/open/pay/void bill |
| 12 Banking | Done | Bank accounts/transactions/match (no Plaid) |
| 13 Reports | Done | TB, BS, IS, fund balance |
| 14 Budgets | Done | Create/lines/activate + vs actual |
| 15 Close polish | Done for A | Period close RPC+UI done; AI Close / filings deferred |

## Deferred (not required for Church MVP A)
- Plaid / bank connectors
- AI Close automation scores
- External compliance filing
- Cash flow statement
- foundation → `main` promotion (unrelated histories)
- Email-delivered invites

## Migrations added
- `20260731103000_organization_settings.sql`
- `20260731113000_create_organization.sql`
- `20260731123000_organization_invites.sql`
- `20260731133000_update_organization_settings.sql`
- `20260801103000_master_data_write_rpcs.sql`
- `20260802103000_create_giving_transaction.sql`
- `20260802113000_bills_ap_rpcs.sql`
- `20260803103000_banking_basics_rpcs.sql`
- `20260804103000_budget_write_rpcs.sql`
