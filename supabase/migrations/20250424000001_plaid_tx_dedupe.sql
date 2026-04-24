-- Prevent double-import of the same Plaid transaction id (append-only model; ignore constraint name collisions on re-run)
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_tenant_plaid_id
  ON parable_ledger.transactions (tenant_id, (metadata ->> 'plaid_transaction_id'))
  WHERE (metadata ->> 'plaid_transaction_id') IS NOT NULL
    AND (metadata ->> 'import_source') = 'plaid';
