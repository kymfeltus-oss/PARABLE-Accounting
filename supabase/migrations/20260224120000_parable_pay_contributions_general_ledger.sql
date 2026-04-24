-- Parable Pay — member contributions + general_ledger journal when SECURED
-- Debit 1010 Operating cash · Credit 4010 Tithes & offerings (or revenue_account_code)
-- Optional link to staff_onboarding for staff-directory identity; member_id -> congregation.

-- ---------------------------------------------------------------------------
-- 1) general_ledger: posted journal lines (double-entry, one row per line)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parable_ledger.general_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL,
    line_number SMALLINT NOT NULL,
    account_code INTEGER NOT NULL,
    debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    narrative TEXT,
    source_type TEXT NOT NULL DEFAULT 'member_contribution',
    source_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT gl_one_side_positive CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
    ),
    CONSTRAINT uq_general_ledger_je_line UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_general_ledger_tenant_created
    ON parable_ledger.general_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_general_ledger_tenant_je
    ON parable_ledger.general_ledger (tenant_id, journal_entry_id);

COMMENT ON TABLE parable_ledger.general_ledger IS
    'Parable Pay and future GL: journal lines. Pairs of rows share journal_entry_id (e.g. Dr cash / Cr revenue).';
COMMENT ON COLUMN parable_ledger.general_ledger.source_id IS
    'FK to originating business key when applicable, e.g. member_contributions.id';

-- ---------------------------------------------------------------------------
-- 2) member_contributions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parable_ledger.member_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    -- Congregation giver; aligns with v_member_stewardship_giving and transactions.metadata->member_id
    member_id UUID NOT NULL REFERENCES parable_ledger.congregation_members (id) ON DELETE RESTRICT,
    -- Optional: tie to a staff row when the same person exists in staff_onboarding (KYC / directory)
    linked_staff_id UUID REFERENCES parable_ledger.staff_onboarding (id) ON DELETE SET NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    -- Uniquely identifies fund row per ministry (ministry_funds is scoped by tenant + fund_code)
    fund_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SECURED')),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Override default 4010 tithes if the fund posts to a different UCOA revenue line
    revenue_account_code INTEGER NOT NULL DEFAULT 4010,
    gl_journal_entry_id UUID,
    gl_posted_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_member_contributions_fund
        FOREIGN KEY (tenant_id, fund_id)
        REFERENCES parable_ledger.ministry_funds (tenant_id, fund_code)
        ON DELETE RESTRICT
);

-- Normalize status to uppercase for app consistency
CREATE OR REPLACE FUNCTION parable_ledger.member_contributions_status_upper()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.status := upper(NEW.status);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_contributions_status_upper ON parable_ledger.member_contributions;
CREATE TRIGGER tr_member_contributions_status_upper
BEFORE INSERT OR UPDATE OF status ON parable_ledger.member_contributions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.member_contributions_status_upper();

CREATE INDEX IF NOT EXISTS idx_member_contrib_tenant_status
    ON parable_ledger.member_contributions (tenant_id, status, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_member_contrib_member
    ON parable_ledger.member_contributions (tenant_id, member_id);
CREATE INDEX IF NOT EXISTS idx_member_contrib_linked_staff
    ON parable_ledger.member_contributions (linked_staff_id)
    WHERE linked_staff_id IS NOT NULL;

COMMENT ON TABLE parable_ledger.member_contributions IS
    'Parable Pay: inbound gifts before/after secure settlement. SECURED => GL post (1010/4010).';
COMMENT ON COLUMN parable_ledger.member_contributions.linked_staff_id IS
    'Optional link to parable_ledger.staff_onboarding for identity / HR directory crosswalk.';

-- ---------------------------------------------------------------------------
-- 3) Validate member + staff belong to same tenant (BEFORE I/U)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION parable_ledger.member_contributions_enforce_tenant_people()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  m_tenant UUID;
  s_tenant UUID;
BEGIN
  SELECT c.tenant_id INTO m_tenant FROM parable_ledger.congregation_members c WHERE c.id = NEW.member_id;
  IF m_tenant IS NULL OR m_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'member_contributions: member_id must belong to tenant_id';
  END IF;
  IF NEW.linked_staff_id IS NOT NULL THEN
    SELECT s.tenant_id INTO s_tenant FROM parable_ledger.staff_onboarding s WHERE s.id = NEW.linked_staff_id;
    IF s_tenant IS NULL OR s_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'member_contributions: linked_staff_id must belong to tenant_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_contrib_tenant_people ON parable_ledger.member_contributions;
CREATE TRIGGER tr_member_contrib_tenant_people
BEFORE INSERT OR UPDATE ON parable_ledger.member_contributions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.member_contributions_enforce_tenant_people();

-- ---------------------------------------------------------------------------
-- 4) SECURED => two GL lines (1010 Dr, revenue Cr). Idempotent via gl_posted_at
-- UCOA defaults: 1010 = Operating cash, 4010 = Tithes & offerings (override revenue_account_code)
-- AFTER trigger: RETURN NULL; persist via UPDATE (does not re-fire this trigger — not UPDATE OF status)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION parable_ledger.member_contribution_post_to_gl()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = parable_ledger, public
AS $$
DECLARE
  v_je UUID;
  v_amt NUMERIC(14, 2) := NEW.amount;
  v_cash INTEGER := 1010; -- Operating cash
  v_rev  INTEGER;
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
  );
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
    gl_journal_entry_id = v_je,
    updated_at = now()
  WHERE id = NEW.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_member_contrib_post_gl ON parable_ledger.member_contributions;
CREATE TRIGGER tr_member_contrib_post_gl
AFTER INSERT OR UPDATE OF status ON parable_ledger.member_contributions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.member_contribution_post_to_gl();

DROP TRIGGER IF EXISTS tr_member_contrib_updated ON parable_ledger.member_contributions;
CREATE TRIGGER tr_member_contrib_updated
BEFORE UPDATE ON parable_ledger.member_contributions
FOR EACH ROW
EXECUTE PROCEDURE parable_ledger.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants (match other parable_ledger app tables; tighten in production)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.member_contributions TO postgres, service_role, authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON parable_ledger.general_ledger TO postgres, service_role, authenticated, anon;

ALTER TABLE parable_ledger.member_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parable_ledger.general_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_contributions_all ON parable_ledger.member_contributions;
CREATE POLICY member_contributions_all ON parable_ledger.member_contributions
    FOR ALL TO postgres, service_role, authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS general_ledger_all ON parable_ledger.general_ledger;
CREATE POLICY general_ledger_all ON parable_ledger.general_ledger
    FOR ALL TO postgres, service_role, authenticated, anon USING (true) WITH CHECK (true);
