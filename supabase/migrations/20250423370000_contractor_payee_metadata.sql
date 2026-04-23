-- Payout / W-9 nudge state for instant honorarium (merge in app JSON)

ALTER TABLE parable_ledger.contractor_payees
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN parable_ledger.contractor_payees.metadata IS
  'e.g. payout_held, w9_request_queued_at, w9_breach — Green Room + watchdog.';
