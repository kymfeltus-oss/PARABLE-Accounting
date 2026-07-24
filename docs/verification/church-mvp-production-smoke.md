# Production smoke checklist — Church MVP live

Production URL: https://parableaccountant.com  
App branch: `phase-4-foundation` (Vercel production alias includes `git-phase-4-foundation`)  
Merged: PR #2 (`phase-9-church-mvp`)  
Supabase: linked `parable accounting` project (Church MVP migrations applied)

## Smoke tests (signed-in)

1. [ ] Sign in at https://parableaccountant.com/login
2. [ ] If no membership: see **Set up my ministry** / **Ministry web name** (not only “contact admin”)
3. [ ] Create or open ministry → land on Dashboard
4. [ ] Giving: record a gift
5. [ ] Vendors + Expenses or Bills: create and post
6. [ ] Reports: Trial Balance / Balance Sheet / Income Statement / Fund Balance populate
7. [ ] Settings: create invite code; second user can join
8. [ ] Sign out / sign in still resolves the correct ministry

## Notes

- GitHub default branch may still be `main` (older unrelated history). Live app is deployed from `phase-4-foundation`.
- Optional cleanup later: set GitHub default branch to `phase-4-foundation`, archive/retire old `main` marketing app if unused.
