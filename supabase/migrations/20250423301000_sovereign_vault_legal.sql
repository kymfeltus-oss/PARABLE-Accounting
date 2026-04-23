-- Add LEGAL pillar for contracts, lease, IP (Sovereign Vault v2)

DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'parable_ledger'
    AND t.relname = 'sovereign_vault'
    AND c.contype = 'c'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE parable_ledger.sovereign_vault DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE parable_ledger.sovereign_vault
ADD CONSTRAINT sovereign_vault_category_check CHECK (
  category IN (
    'GOVERNANCE',
    'IRS_TAX',
    'INSURANCE',
    'FINANCIALS',
    'CONTINUITY',
    'RISK',
    'LEGAL',
    'OTHER'
  )
);
