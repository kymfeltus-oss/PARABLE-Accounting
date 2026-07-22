-- Parable Accounting — read-only live schema verification
-- Run manually in Supabase SQL Editor after runtime-verification.sql succeeds.
-- SELECT queries only. No DDL/DML.

-- ==================================================
-- 1. Expected tables — existence check (all 28)
-- ==================================================

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
existing_tables as (
  select tablename as table_name
  from pg_catalog.pg_tables
  where schemaname = 'public'
)
select
  e.sort_order,
  e.table_name,
  (x.table_name is not null) as table_exists
from expected_tables e
left join existing_tables x
  on x.table_name = e.table_name
order by e.sort_order;


-- ==================================================
-- 2. Missing expected tables (should return zero rows)
-- ==================================================

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
existing_tables as (
  select tablename as table_name
  from pg_catalog.pg_tables
  where schemaname = 'public'
)
select
  e.sort_order,
  e.table_name
from expected_tables e
left join existing_tables x
  on x.table_name = e.table_name
where x.table_name is null
order by e.sort_order;


-- ==================================================
-- 3. RLS enabled status (all 28 expected tables)
-- ==================================================

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
)
select
  e.sort_order,
  e.table_name,
  (c.oid is not null) as table_exists,
  coalesce(c.relrowsecurity, false) as rls_enabled
from expected_tables e
left join pg_catalog.pg_namespace n
  on n.nspname = 'public'
left join pg_catalog.pg_class c
  on c.relnamespace = n.oid
 and c.relname = e.table_name
 and c.relkind = 'r'
order by e.sort_order;


-- ==================================================
-- 4. Foreign-key count by table (all 28)
-- ==================================================

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
table_refs as (
  select
    e.sort_order,
    e.table_name,
    c.oid as table_oid
  from expected_tables e
  left join pg_catalog.pg_namespace n
    on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = e.table_name
   and c.relkind = 'r'
)
select
  t.sort_order,
  t.table_name,
  (t.table_oid is not null) as table_exists,
  count(con.oid) filter (where con.contype = 'f') as foreign_key_count
from table_refs t
left join pg_catalog.pg_constraint con
  on con.conrelid = t.table_oid
 and con.contype = 'f'
group by t.sort_order, t.table_name, t.table_oid
order by t.sort_order;


-- ==================================================
-- 5. Check-constraint count by table (all 28)
-- ==================================================

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
table_refs as (
  select
    e.sort_order,
    e.table_name,
    c.oid as table_oid
  from expected_tables e
  left join pg_catalog.pg_namespace n
    on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = e.table_name
   and c.relkind = 'r'
)
select
  t.sort_order,
  t.table_name,
  (t.table_oid is not null) as table_exists,
  count(con.oid) filter (where con.contype = 'c') as check_constraint_count
from table_refs t
left join pg_catalog.pg_constraint con
  on con.conrelid = t.table_oid
 and con.contype = 'c'
group by t.sort_order, t.table_name, t.table_oid
order by t.sort_order;


-- ==================================================
-- 6. Unique-constraint count by table (all 28)
-- ==================================================

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
table_refs as (
  select
    e.sort_order,
    e.table_name,
    c.oid as table_oid
  from expected_tables e
  left join pg_catalog.pg_namespace n
    on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = e.table_name
   and c.relkind = 'r'
)
select
  t.sort_order,
  t.table_name,
  (t.table_oid is not null) as table_exists,
  count(con.oid) filter (where con.contype = 'u') as unique_constraint_count
from table_refs t
left join pg_catalog.pg_constraint con
  on con.conrelid = t.table_oid
 and con.contype = 'u'
group by t.sort_order, t.table_name, t.table_oid
order by t.sort_order;
