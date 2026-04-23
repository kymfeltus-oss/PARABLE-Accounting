-- PARABLE: Human Capital & Payroll Classification (reference; applied via Supabase migration)
-- See: supabase/migrations/20250423360000_staff_onboarding.sql for parable_ledger.staff_onboarding
--
-- Rationale: tenant_id + sovereignty gates; first minister payroll nudge requires housing in vault (app layer).

-- Legacy sketch (replaced in migration by parable_ledger + gates JSONB + FK to sovereign_vault):
-- CREATE TABLE staff_onboarding (...);
