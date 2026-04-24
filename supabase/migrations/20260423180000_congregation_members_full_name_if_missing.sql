-- Hand-built congregation_members (first_name/last_name only) lacks columns the app selects.
-- Member portal: id, full_name, email, phone — see MemberPortalSessionContext.tsx.

ALTER TABLE parable_ledger.congregation_members
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Backfill from first_name + last_name when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'congregation_members' AND column_name = 'first_name'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'congregation_members' AND column_name = 'last_name'
  ) THEN
    UPDATE parable_ledger.congregation_members cm
    SET full_name = trim(concat_ws(' ', nullif(trim(cm.first_name), ''), nullif(trim(cm.last_name), '')))
    WHERE cm.full_name IS NULL OR btrim(cm.full_name) = '';
  END IF;
END $$;

-- Email local-part as display name fallback
UPDATE parable_ledger.congregation_members cm
SET full_name = nullif(trim(split_part(cm.email, '@', 1)), '')
WHERE (cm.full_name IS NULL OR btrim(cm.full_name) = '')
  AND cm.email IS NOT NULL AND btrim(cm.email) <> '';

UPDATE parable_ledger.congregation_members
SET full_name = 'Member'
WHERE full_name IS NULL OR btrim(full_name) = '';

ALTER TABLE parable_ledger.congregation_members
  ALTER COLUMN full_name SET DEFAULT 'Member';

ALTER TABLE parable_ledger.congregation_members
  ALTER COLUMN full_name SET NOT NULL;

NOTIFY pgrst, 'reload schema';
