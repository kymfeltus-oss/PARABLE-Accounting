-- Sovereign Onboarding: persisted funnel stage (optional override over tenure-inferred)

ALTER TABLE parable_ledger.congregation_members
ADD COLUMN IF NOT EXISTS onboarding_stage TEXT NOT NULL DEFAULT 'welcome'
  CHECK (onboarding_stage IN ('welcome', 'stewardship', 'discovery', 'active'));

COMMENT ON COLUMN parable_ledger.congregation_members.onboarding_stage IS
  'Funnel: welcome → stewardship → discovery → active. Update via automation or admin.';

CREATE INDEX IF NOT EXISTS idx_congregation_onboarding
  ON parable_ledger.congregation_members (tenant_id, onboarding_stage);
