-- 1) Add legal_name to tenants (idempotent) — used for tax / board-pack (Gate 4 financial review)
ALTER TABLE parable_ledger.tenants
  ADD COLUMN IF NOT EXISTS legal_name TEXT;

-- 2) Formal entity for compliance / tax
UPDATE parable_ledger.tenants
SET legal_name = 'PARABLE FOUNDRY LLC'
WHERE slug = 'parable-master';

-- 3) PostgREST schema cache
NOTIFY pgrst, 'reload schema';
