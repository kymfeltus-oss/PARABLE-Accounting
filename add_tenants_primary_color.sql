-- If PostgREST / the app errors with: column "primary_color" of relation "tenants" does not exist
-- run this in the Supabase SQL Editor, then: NOTIFY pgrst, 'reload schema';

ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#22d3ee';
ALTER TABLE parable_ledger.tenants ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#050505';

NOTIFY pgrst, 'reload schema';
