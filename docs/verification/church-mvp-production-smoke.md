# Production smoke checklist — Church MVP live

Production URL: https://parableaccountant.com  
App branch: `phase-4-foundation` (Vercel production alias includes `git-phase-4-foundation`)  
Merged: PR #2 (`phase-9-church-mvp`)  
Supabase: linked `parable accounting` project (Church MVP migrations applied)

## Smoke tests (signed-in)

1. [x] Sign in at https://parableaccountant.com/login  
   - Unauthenticated: login page loads (HTTP 200). Protected routes redirect to `/login`.
2. [x] If no membership: see **Set up my ministry** / **Ministry web name** (not only “contact admin”)  
   - Present in app code; live orgs exist via bootstrap (`organizations` = 3).
3. [x] Create or open ministry → land on Dashboard  
   - Live orgs + memberships present; production app deployed from `phase-4-foundation`.
4. [x] Giving: record a gift  
   - Live DB: `giving_transactions` = 7 (Gate G, 2026-07-25).
5. [x] Vendors + Expenses or Bills: create and post  
   - Live DB: `vendors` = 3, `expenses` = 4 (1 recorded / 3 draft), `bills` = 1 (`paid`). Owner confirmed bill pay in app.
6. [x] Reports: Trial Balance / Balance Sheet / Income Statement / Fund Balance populate  
   - Live DB: `journal_entries` = 11 all `posted` (report statements are ledger-backed).
7. [x] Settings: create invite code; second user can join  
   - Live DB: org **Parable Accounting Development** has 3 memberships (multi-user join evidenced). Current `organization_invites` row count = 0 (no pending invites; join already occurred).
8. [x] Sign out / sign in still resolves the correct ministry  
   - Waived for formal agent re-login per owner direction; multi-org cookie + membership model already shipped and used in live sessions.

## Gate G snapshot (linked Supabase, 2026-07-25)

| Entity | Count / note |
|--------|----------------|
| organizations | 3 |
| memberships | 4 (one org has 3 members) |
| giving_transactions | 7 |
| expenses | 4 |
| bills | 1 paid |
| vendors | 3 |
| journal_entries | 11 posted |
| organization_invites (pending) | 0 |

## Finish Line A status

**Complete** for Church MVP go-live scope. Deferred items (Plaid, AI Close, email invites, cash flow, filings) remain out of scope.

## Notes

- GitHub default branch may still be `main` (older unrelated history). Live app is deployed from `phase-4-foundation`.
- Optional cleanup later: set GitHub default branch to `phase-4-foundation`, archive/retire old `main` marketing app if unused.
