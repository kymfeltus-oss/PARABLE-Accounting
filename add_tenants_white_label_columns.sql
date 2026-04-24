-- If PostgREST / BrandProvider errors with: column tenants.logo_url does not exist
-- (or missing custom_domain, tax_id_ein, fiscal_year_start), run in Supabase SQL Editor,
-- then Dashboard → Settings → API → confirm "Exposed schemas" includes parable_ledger.

ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS tax_id_ein TEXT;
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS fiscal_year_start DATE NOT NULL DEFAULT '2026-01-01';

NOTIFY pgrst, 'reload schema';
