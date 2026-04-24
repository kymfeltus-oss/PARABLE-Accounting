-- YTD stewardship: include SECURED member_contributions (Parable Pay) alongside member-linked donations.
-- Realtime: so Accounting AR live feed and Member dossier can subscribe to inserts without polling.

-- ---------------------------------------------------------------------------
-- 1) Replace v_member_stewardship_giving to sum both sources (UTC YTD)
-- Brownfield: roster may omit member_kind; member_contributions may use created_at instead of "timestamp".
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_has_member_kind boolean;
  v_has_contrib_ts boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'congregation_members' AND column_name = 'member_kind'
  ) INTO v_has_member_kind;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'parable_ledger' AND table_name = 'member_contributions' AND column_name = 'timestamp'
  ) INTO v_has_contrib_ts;

  IF v_has_member_kind AND v_has_contrib_ts THEN
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          m.member_kind,
          (
              COALESCE(tx.ytd, 0::numeric) + COALESCE(pp.ytd, 0::numeric)
          )::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ABS(t.amount::numeric)), 0::numeric) AS ytd
          FROM parable_ledger.transactions t
          WHERE t.tenant_id = m.tenant_id
            AND t.tx_type = 'donation'
            AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
            AND (t.metadata->>'member_id') = m.id::text
      ) AS tx ON true
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(c.amount), 0::numeric) AS ytd
          FROM parable_ledger.member_contributions c
          WHERE c.tenant_id = m.tenant_id
            AND c.member_id = m.id
            AND c.status = 'SECURED'
            AND c."timestamp" >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
      ) AS pp ON true
    $vk$;
  ELSIF v_has_member_kind THEN
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          m.member_kind,
          (
              COALESCE(tx.ytd, 0::numeric) + COALESCE(pp.ytd, 0::numeric)
          )::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ABS(t.amount::numeric)), 0::numeric) AS ytd
          FROM parable_ledger.transactions t
          WHERE t.tenant_id = m.tenant_id
            AND t.tx_type = 'donation'
            AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
            AND (t.metadata->>'member_id') = m.id::text
      ) AS tx ON true
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(c.amount), 0::numeric) AS ytd
          FROM parable_ledger.member_contributions c
          WHERE c.tenant_id = m.tenant_id
            AND c.member_id = m.id
            AND c.status = 'SECURED'
            AND c.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
      ) AS pp ON true
    $vk$;
  ELSIF v_has_contrib_ts THEN
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          'active'::text AS member_kind,
          (
              COALESCE(tx.ytd, 0::numeric) + COALESCE(pp.ytd, 0::numeric)
          )::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ABS(t.amount::numeric)), 0::numeric) AS ytd
          FROM parable_ledger.transactions t
          WHERE t.tenant_id = m.tenant_id
            AND t.tx_type = 'donation'
            AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
            AND (t.metadata->>'member_id') = m.id::text
      ) AS tx ON true
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(c.amount), 0::numeric) AS ytd
          FROM parable_ledger.member_contributions c
          WHERE c.tenant_id = m.tenant_id
            AND c.member_id = m.id
            AND c.status = 'SECURED'
            AND c."timestamp" >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
      ) AS pp ON true
    $vk$;
  ELSE
    EXECUTE $vk$
      CREATE OR REPLACE VIEW parable_ledger.v_member_stewardship_giving AS
      SELECT
          m.tenant_id,
          m.id AS member_id,
          m.full_name,
          'active'::text AS member_kind,
          (
              COALESCE(tx.ytd, 0::numeric) + COALESCE(pp.ytd, 0::numeric)
          )::numeric(14, 2) AS ytd_giving
      FROM parable_ledger.congregation_members m
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ABS(t.amount::numeric)), 0::numeric) AS ytd
          FROM parable_ledger.transactions t
          WHERE t.tenant_id = m.tenant_id
            AND t.tx_type = 'donation'
            AND t.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
            AND (t.metadata->>'member_id') = m.id::text
      ) AS tx ON true
      LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(c.amount), 0::numeric) AS ytd
          FROM parable_ledger.member_contributions c
          WHERE c.tenant_id = m.tenant_id
            AND c.member_id = m.id
            AND c.status = 'SECURED'
            AND c.created_at >= date_trunc('year', (now() AT TIME ZONE 'UTC'))
      ) AS pp ON true
    $vk$;
  END IF;
END $$;

COMMENT ON VIEW parable_ledger.v_member_stewardship_giving IS
    'YTD giving: Stripe/metadata donations + Parable Pay member_contributions (SECURED).';

-- ---------------------------------------------------------------------------
-- 2) supabase_realtime: Parable Pay inserts
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'parable_ledger'
      AND tablename = 'member_contributions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE parable_ledger.member_contributions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'skipping supabase_realtime add: %', SQLERRM;
END
$$;
