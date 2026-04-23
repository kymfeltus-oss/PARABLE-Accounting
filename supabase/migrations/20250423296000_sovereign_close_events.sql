-- Immutable log for Sovereign Close gate advances: actor, time, and SHA-256 of the gate snapshot.
CREATE TABLE parable_ledger.sovereign_close_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES parable_ledger.tenants (id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    gate_from TEXT NOT NULL
        CHECK (gate_from IN (
            'GATE_INPUT', 'GATE_SHIELD', 'GATE_RECONCILE', 'GATE_RESTRICTED', 'GATE_SEAL', 'SYSTEM'
        )),
    gate_to TEXT
        CHECK (
            gate_to IS NULL
            OR gate_to IN (
                'GATE_INPUT', 'GATE_SHIELD', 'GATE_RECONCILE', 'GATE_RESTRICTED', 'GATE_SEAL', 'COMPLETE'
            )
        ),
    user_id UUID,
    payload_hash CHAR(64) NOT NULL
        CHECK (char_length(payload_hash) = 64),
    payload_json JSONB NOT NULL DEFAULT '{}',
    client_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sovereign_close_tenant_month ON parable_ledger.sovereign_close_events (tenant_id, month_start DESC, created_at DESC);

COMMENT ON TABLE parable_ledger.sovereign_close_events IS
    'Append-only gate transitions for month-end; hash binds public snapshot.';

GRANT SELECT, INSERT ON parable_ledger.sovereign_close_events TO postgres, service_role, authenticated, anon;
ALTER TABLE parable_ledger.sovereign_close_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sovereign_close_events_insert
    ON parable_ledger.sovereign_close_events
    FOR INSERT
    TO postgres, service_role, authenticated, anon
    WITH CHECK (true);
CREATE POLICY sovereign_close_events_select
    ON parable_ledger.sovereign_close_events
    FOR SELECT
    TO postgres, service_role, authenticated, anon
    USING (true);

-- No UPDATE/DELETE policies — append only at application level; DB can add triggers later.
