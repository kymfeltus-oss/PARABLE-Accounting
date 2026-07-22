-- Parable Accounting — consolidated read-only live schema summary
-- Run manually in Supabase SQL Editor. One result set: 28 table rows + 1 summary row.
-- SELECT queries only. No DDL/DML.

with expected_tables (sort_order, table_name) as (
  values
    (1, 'organizations'),
    (2, 'organization_memberships'),
    (3, 'funds'),
    (4, 'accounts'),
    (5, 'accounting_periods'),
    (6, 'journal_entries'),
    (7, 'journal_entry_lines'),
    (8, 'bank_accounts'),
    (9, 'bank_transactions'),
    (10, 'vendors'),
    (11, 'bills'),
    (12, 'bill_lines'),
    (13, 'bill_payments'),
    (14, 'expenses'),
    (15, 'expense_lines'),
    (16, 'budgets'),
    (17, 'budget_lines'),
    (18, 'members'),
    (19, 'giving_transactions'),
    (20, 'compliance_items'),
    (21, 'exceptions'),
    (22, 'audit_events'),
    (23, 'audit_documents'),
    (24, 'reconciliations'),
    (25, 'reconciliation_items'),
    (26, 'bank_transaction_matches'),
    (27, 'close_sessions'),
    (28, 'close_tasks')
),
table_details as (
  select
    e.sort_order,
    e.table_name,
    (c.oid is not null) as table_exists,
    coalesce(c.relrowsecurity, false) as rls_enabled,
    count(con.oid) filter (where con.contype = 'f') as foreign_key_count,
    count(con.oid) filter (where con.contype = 'c') as check_constraint_count,
    count(con.oid) filter (where con.contype = 'u') as unique_constraint_count
  from expected_tables e
  left join pg_catalog.pg_namespace n
    on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = e.table_name
   and c.relkind = 'r'
  left join pg_catalog.pg_constraint con
    on con.conrelid = c.oid
   and con.contype in ('f', 'c', 'u')
  group by
    e.sort_order,
    e.table_name,
    c.oid,
    c.relrowsecurity
)
select
  sort_order,
  table_name,
  table_exists,
  rls_enabled,
  foreign_key_count,
  check_constraint_count,
  unique_constraint_count
from table_details

union all

select
  999 as sort_order,
  '__SUMMARY__' as table_name,
  bool_and(table_exists) as table_exists,
  bool_and(table_exists and rls_enabled) as rls_enabled,
  0 as foreign_key_count,
  0 as check_constraint_count,
  0 as unique_constraint_count
from table_details

order by sort_order;
