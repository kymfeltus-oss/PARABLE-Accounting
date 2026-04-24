-- member_contributions.gl_journal_entry_id must reference general_ledger.id (line PK).
-- Older trigger versions stored journal_entry_id (batch UUID) there, violating FKs to general_ledger(id).

ALTER TABLE parable_ledger.member_contributions
  DROP CONSTRAINT IF EXISTS member_contributions_gl_journal_entry_id_fkey;

-- Repoint legacy values that matched journal_entry_id but not id (first line of batch).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'general_ledger' AND column_name = 'journal_entry_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'general_ledger' AND column_name = 'line_number'
  ) THEN
    UPDATE parable_ledger.member_contributions mc
    SET gl_journal_entry_id = gl.id
    FROM parable_ledger.general_ledger gl
    WHERE mc.gl_journal_entry_id IS NOT NULL
      AND mc.gl_journal_entry_id = gl.journal_entry_id
      AND gl.line_number = 1
      AND NOT EXISTS (
        SELECT 1 FROM parable_ledger.general_ledger g2 WHERE g2.id = mc.gl_journal_entry_id
      );
  END IF;
END $$;

-- Clear orphans (no matching GL row)
UPDATE parable_ledger.member_contributions mc
SET gl_journal_entry_id = NULL
WHERE mc.gl_journal_entry_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM parable_ledger.general_ledger gl WHERE gl.id = mc.gl_journal_entry_id);

CREATE OR REPLACE FUNCTION parable_ledger.member_contribution_post_to_gl()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
DECLARE
  v_je UUID;
  v_gl_first_id UUID;
  v_amt NUMERIC(14, 2) := NEW.amount;
  v_cash INTEGER := 1010;
  v_rev INTEGER;
BEGIN
  IF NEW.status <> 'SECURED' OR NEW.gl_posted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  v_rev := COALESCE(NEW.revenue_account_code, 4010);

  IF NOT EXISTS (
    SELECT 1 FROM parable_ledger.chart_of_accounts c
    WHERE c.tenant_id = NEW.tenant_id AND c.account_code = v_cash
  ) THEN
    RAISE EXCEPTION
      'Parable Pay GL: add chart_of_accounts for tenant % (missing cash account %).',
      NEW.tenant_id, v_cash;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM parable_ledger.chart_of_accounts c
    WHERE c.tenant_id = NEW.tenant_id AND c.account_code = v_rev
  ) THEN
    RAISE EXCEPTION
      'Parable Pay GL: add chart_of_accounts for tenant % (missing revenue account %).',
      NEW.tenant_id, v_rev;
  END IF;

  v_je := gen_random_uuid();

  INSERT INTO parable_ledger.general_ledger (
    tenant_id, journal_entry_id, line_number, account_code, debit, credit, narrative, source_type, source_id
  ) VALUES (
    NEW.tenant_id, v_je, 1, v_cash, v_amt, 0,
    'Parable Pay: operating cash (member_contribution ' || NEW.id::text || ')', 'member_contribution', NEW.id
  )
  RETURNING id INTO v_gl_first_id;

  INSERT INTO parable_ledger.general_ledger (
    tenant_id, journal_entry_id, line_number, account_code, debit, credit, narrative, source_type, source_id
  ) VALUES (
    NEW.tenant_id, v_je, 2, v_rev, 0, v_amt,
    'Parable Pay: tithes & offerings / fund ' || COALESCE(NEW.fund_id, '') || ' (member ' || NEW.member_id::text || ')',
    'member_contribution', NEW.id
  );

  UPDATE parable_ledger.member_contributions
  SET
    gl_posted_at = now(),
    gl_journal_entry_id = v_gl_first_id,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NULL;
END;
$$;

COMMENT ON COLUMN parable_ledger.member_contributions.gl_journal_entry_id IS
  'First posted general_ledger row id for this gift; the debit/credit pair shares general_ledger.journal_entry_id.';

DO $$
BEGIN
  ALTER TABLE parable_ledger.member_contributions
    ADD CONSTRAINT member_contributions_gl_journal_entry_id_fkey
    FOREIGN KEY (gl_journal_entry_id) REFERENCES parable_ledger.general_ledger (id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
