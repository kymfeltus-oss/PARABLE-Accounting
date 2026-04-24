-- Idempotent: hand-built or pre–white-label parable_ledger.tenants missing columns
-- that BrandProvider / PostgREST selects (see src/components/branding/BrandProvider.tsx).
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS tax_id_ein TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS fiscal_year_start DATE NOT NULL DEFAULT '2026-01-01';

NOTIFY pgrst, 'reload schema';
