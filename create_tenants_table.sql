-- =============================================================================
-- Bootstrap: parable_ledger.tenants (empty projects / hand-built Supabase)
-- If you already use repo migrations (e.g. 20250423240000_tenants_multitenant.sql),
-- the table may exist with different columns (slug, display_name). This script
-- is safe to read for reference; only run the blocks that match your DB.
-- =============================================================================

-- 1. Ensure the schema exists
CREATE SCHEMA IF NOT EXISTS parable_ledger;

-- 2. Create the 'tenants' table (simplified column set — adjust if you already have tenants)
-- Uses gen_random_uuid() (no uuid-ossp extension required in Supabase / PG 13+)
CREATE TABLE IF NOT EXISTS parable_ledger.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name TEXT NOT NULL,
    ein TEXT, -- Employer Identification Number
    fiscal_year_end TEXT DEFAULT '12-31',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Seed with a default record so SELECT ... LIMIT 1 is non-empty
INSERT INTO parable_ledger.tenants (id, organization_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'PARABLE Master Entity')
ON CONFLICT (id) DO NOTHING;

-- 4. Grant permissions (API must be able to read/insert)
GRANT ALL ON TABLE parable_ledger.tenants TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA parable_ledger TO anon, authenticated, service_role;

-- 5. Refresh PostgREST cache (if your role is allowed; otherwise set Exposed schemas in Dashboard)
NOTIFY pgrst, 'reload schema';
