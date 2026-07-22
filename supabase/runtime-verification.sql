begin;

-- ==================================================
-- 01: 20260718021048_create_organizations.sql
-- ==================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (char_length(btrim(name)) > 0),
  constraint organizations_slug_key unique (slug),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_status_valid check (status in ('active', 'inactive'))
);

alter table public.organizations enable row level security;

-- ==================================================
-- 02: 20260718025545_create_organization_memberships.sql
-- ==================================================

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_memberships_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint organization_memberships_organization_user_key
    unique (organization_id, user_id)
);

alter table public.organization_memberships enable row level security;

-- ==================================================
-- 03: 20260718030430_create_funds.sql
-- ==================================================

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  code text,
  fund_type text not null default 'unrestricted',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint funds_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint funds_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint funds_code_not_blank
    check (code is null or char_length(btrim(code)) > 0),

  constraint funds_type_valid
    check (fund_type in ('unrestricted', 'temporarily_restricted', 'permanently_restricted')),

  constraint funds_status_valid
    check (status in ('active', 'inactive')),

  constraint funds_organization_name_key
    unique (organization_id, name),

  constraint funds_organization_code_key
    unique (organization_id, code)
);

alter table public.funds enable row level security;

-- ==================================================
-- 04: 20260718031815_create_accounts.sql
-- ==================================================

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  parent_account_id uuid,
  code text not null,
  name text not null,
  account_type text not null,
  is_posting boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint accounts_parent_account_id_fkey
    foreign key (parent_account_id)
    references public.accounts(id)
    on delete restrict,

  constraint accounts_code_not_blank
    check (char_length(btrim(code)) > 0),

  constraint accounts_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint accounts_type_valid
    check (
      account_type in (
        'asset',
        'liability',
        'net_asset',
        'revenue',
        'expense'
      )
    ),

  constraint accounts_status_valid
    check (status in ('active', 'inactive')),

  constraint accounts_organization_code_key
    unique (organization_id, code)
);

alter table public.accounts enable row level security;

-- ==================================================
-- 05: 20260718033120_create_accounting_periods.sql
-- ==================================================

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounting_periods_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint accounting_periods_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint accounting_periods_date_range_valid
    check (start_date <= end_date),

  constraint accounting_periods_status_valid
    check (status in ('open', 'closed', 'locked')),

  constraint accounting_periods_organization_dates_key
    unique (organization_id, start_date, end_date)
);

alter table public.accounting_periods enable row level security;

-- ==================================================
-- 06: 20260718034310_create_journal_entries.sql
-- ==================================================

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  accounting_period_id uuid not null,
  entry_number text not null,
  entry_date date not null,
  description text not null,
  source_type text not null default 'manual',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint journal_entries_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint journal_entries_accounting_period_id_fkey
    foreign key (accounting_period_id)
    references public.accounting_periods(id)
    on delete restrict,

  constraint journal_entries_entry_number_not_blank
    check (char_length(btrim(entry_number)) > 0),

  constraint journal_entries_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint journal_entries_source_type_valid
    check (
      source_type in (
        'manual',
        'giving',
        'banking',
        'expense',
        'bill',
        'adjustment',
        'closing'
      )
    ),

  constraint journal_entries_status_valid
    check (status in ('draft', 'posted', 'reversed')),

  constraint journal_entries_organization_number_key
    unique (organization_id, entry_number)
);

alter table public.journal_entries enable row level security;

-- ==================================================
-- 07: 20260718035620_create_journal_entry_lines.sql
-- ==================================================

create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  debit_amount numeric(18,2) not null default 0,
  credit_amount numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint journal_entry_lines_journal_entry_id_fkey
    foreign key (journal_entry_id)
    references public.journal_entries(id)
    on delete cascade,

  constraint journal_entry_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint journal_entry_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint journal_entry_lines_line_number_positive
    check (line_number > 0),

  constraint journal_entry_lines_debit_nonnegative
    check (debit_amount >= 0),

  constraint journal_entry_lines_credit_nonnegative
    check (credit_amount >= 0),

  constraint journal_entry_lines_one_sided_amount
    check (
      (debit_amount > 0 and credit_amount = 0)
      or
      (credit_amount > 0 and debit_amount = 0)
    ),

  constraint journal_entry_lines_journal_line_key
    unique (journal_entry_id, line_number)
);

alter table public.journal_entry_lines enable row level security;

-- ==================================================
-- 08: 20260718040930_create_bank_accounts.sql
-- ==================================================

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  account_id uuid not null,
  name text not null,
  institution_name text,
  account_type text not null default 'checking',
  last_four text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_accounts_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_accounts_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint bank_accounts_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint bank_accounts_institution_name_not_blank
    check (
      institution_name is null
      or char_length(btrim(institution_name)) > 0
    ),

  constraint bank_accounts_type_valid
    check (
      account_type in (
        'checking',
        'savings',
        'money_market'
      )
    ),

  constraint bank_accounts_last_four_valid
    check (
      last_four is null
      or last_four ~ '^[0-9]{4}$'
    ),

  constraint bank_accounts_status_valid
    check (status in ('active', 'inactive')),

  constraint bank_accounts_organization_name_key
    unique (organization_id, name)
);

alter table public.bank_accounts enable row level security;

-- ==================================================
-- 09: 20260718042745_create_bank_transactions.sql
-- ==================================================

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null,
  transaction_date date not null,
  posted_date date,
  description text not null,
  amount numeric(18,2) not null,
  reference text,
  source_type text not null default 'manual',
  external_id text,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_transactions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_transactions_bank_account_id_fkey
    foreign key (bank_account_id)
    references public.bank_accounts(id)
    on delete cascade,

  constraint bank_transactions_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint bank_transactions_amount_nonzero
    check (amount <> 0),

  constraint bank_transactions_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint bank_transactions_source_type_valid
    check (
      source_type in (
        'manual',
        'import',
        'bank_feed'
      )
    ),

  constraint bank_transactions_external_id_not_blank
    check (
      external_id is null
      or char_length(btrim(external_id)) > 0
    ),

  constraint bank_transactions_status_valid
    check (
      status in (
        'unmatched',
        'matched',
        'excluded'
      )
    ),

  constraint bank_transactions_bank_external_key
    unique (bank_account_id, external_id)
);

alter table public.bank_transactions enable row level security;

-- ==================================================
-- 10: 20260718044330_create_vendors.sql
-- ==================================================

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  email text,
  phone text,
  tax_id_last_four text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vendors_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint vendors_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint vendors_email_not_blank
    check (
      email is null
      or char_length(btrim(email)) > 0
    ),

  constraint vendors_phone_not_blank
    check (
      phone is null
      or char_length(btrim(phone)) > 0
    ),

  constraint vendors_tax_id_last_four_valid
    check (
      tax_id_last_four is null
      or tax_id_last_four ~ '^[0-9]{4}$'
    ),

  constraint vendors_status_valid
    check (status in ('active', 'inactive')),

  constraint vendors_organization_name_key
    unique (organization_id, name)
);

alter table public.vendors enable row level security;

-- ==================================================
-- 11: 20260718050115_create_bills.sql
-- ==================================================

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id uuid not null,
  bill_number text,
  bill_date date not null,
  due_date date,
  description text,
  total_amount numeric(18,2) not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bills_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bills_vendor_id_fkey
    foreign key (vendor_id)
    references public.vendors(id)
    on delete restrict,

  constraint bills_bill_number_not_blank
    check (
      bill_number is null
      or char_length(btrim(bill_number)) > 0
    ),

  constraint bills_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint bills_total_amount_positive
    check (total_amount > 0),

  constraint bills_status_valid
    check (
      status in (
        'draft',
        'open',
        'paid',
        'void'
      )
    ),

  constraint bills_vendor_number_key
    unique (vendor_id, bill_number)
);

alter table public.bills enable row level security;

-- ==================================================
-- 12: 20260718051630_create_bill_lines.sql
-- ==================================================

create table public.bill_lines (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bill_lines_bill_id_fkey
    foreign key (bill_id)
    references public.bills(id)
    on delete cascade,

  constraint bill_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint bill_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint bill_lines_line_number_positive
    check (line_number > 0),

  constraint bill_lines_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint bill_lines_amount_positive
    check (amount > 0),

  constraint bill_lines_bill_line_key
    unique (bill_id, line_number)
);

alter table public.bill_lines enable row level security;

-- ==================================================
-- 13: 20260718053345_create_bill_payments.sql
-- ==================================================

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bill_id uuid not null,
  payment_date date not null,
  amount numeric(18,2) not null,
  reference text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bill_payments_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bill_payments_bill_id_fkey
    foreign key (bill_id)
    references public.bills(id)
    on delete restrict,

  constraint bill_payments_amount_positive
    check (amount > 0),

  constraint bill_payments_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint bill_payments_status_valid
    check (
      status in (
        'recorded',
        'void'
      )
    )
);

alter table public.bill_payments enable row level security;

-- ==================================================
-- 14: 20260718054830_create_expenses.sql
-- ==================================================

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  vendor_id uuid,
  expense_date date not null,
  description text not null,
  total_amount numeric(18,2) not null,
  reference text,
  payment_source text not null default 'other',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenses_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint expenses_vendor_id_fkey
    foreign key (vendor_id)
    references public.vendors(id)
    on delete restrict,

  constraint expenses_description_not_blank
    check (char_length(btrim(description)) > 0),

  constraint expenses_total_amount_positive
    check (total_amount > 0),

  constraint expenses_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint expenses_payment_source_valid
    check (
      payment_source in (
        'bank',
        'card',
        'cash',
        'reimbursement',
        'other'
      )
    ),

  constraint expenses_status_valid
    check (
      status in (
        'draft',
        'recorded',
        'void'
      )
    )
);

alter table public.expenses enable row level security;

-- ==================================================
-- 15: 20260718060415_create_expense_lines.sql
-- ==================================================

create table public.expense_lines (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_lines_expense_id_fkey
    foreign key (expense_id)
    references public.expenses(id)
    on delete cascade,

  constraint expense_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint expense_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint expense_lines_line_number_positive
    check (line_number > 0),

  constraint expense_lines_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint expense_lines_amount_positive
    check (amount > 0),

  constraint expense_lines_expense_line_key
    unique (expense_id, line_number)
);

alter table public.expense_lines enable row level security;

-- ==================================================
-- 16: 20260718062030_create_budgets.sql
-- ==================================================

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budgets_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint budgets_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint budgets_date_range_valid
    check (end_date >= start_date),

  constraint budgets_status_valid
    check (
      status in (
        'draft',
        'active',
        'closed'
      )
    )
);

alter table public.budgets enable row level security;

-- ==================================================
-- 17: 20260718063545_create_budget_lines.sql
-- ==================================================

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null,
  account_id uuid not null,
  fund_id uuid,
  line_number integer not null,
  description text,
  amount numeric(18,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_lines_budget_id_fkey
    foreign key (budget_id)
    references public.budgets(id)
    on delete cascade,

  constraint budget_lines_account_id_fkey
    foreign key (account_id)
    references public.accounts(id)
    on delete restrict,

  constraint budget_lines_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint budget_lines_line_number_positive
    check (line_number > 0),

  constraint budget_lines_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint budget_lines_amount_nonnegative
    check (amount >= 0),

  constraint budget_lines_budget_line_key
    unique (budget_id, line_number)
);

alter table public.budget_lines enable row level security;

-- ==================================================
-- 18: 20260718065100_create_members.sql
-- ==================================================

create table public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint members_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint members_first_name_not_blank
    check (char_length(btrim(first_name)) > 0),

  constraint members_last_name_not_blank
    check (char_length(btrim(last_name)) > 0),

  constraint members_email_not_blank
    check (
      email is null
      or char_length(btrim(email)) > 0
    ),

  constraint members_phone_not_blank
    check (
      phone is null
      or char_length(btrim(phone)) > 0
    ),

  constraint members_status_valid
    check (
      status in (
        'active',
        'inactive'
      )
    )
);

alter table public.members enable row level security;

-- ==================================================
-- 19: 20260718070730_create_giving_transactions.sql
-- ==================================================

create table public.giving_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  member_id uuid,
  fund_id uuid,
  transaction_date date not null,
  amount numeric(18,2) not null,
  giving_method text not null default 'other',
  reference text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint giving_transactions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint giving_transactions_member_id_fkey
    foreign key (member_id)
    references public.members(id)
    on delete set null,

  constraint giving_transactions_fund_id_fkey
    foreign key (fund_id)
    references public.funds(id)
    on delete restrict,

  constraint giving_transactions_amount_positive
    check (amount > 0),

  constraint giving_transactions_method_valid
    check (
      giving_method in (
        'cash',
        'check',
        'card',
        'ach',
        'other'
      )
    ),

  constraint giving_transactions_reference_not_blank
    check (
      reference is null
      or char_length(btrim(reference)) > 0
    ),

  constraint giving_transactions_status_valid
    check (
      status in (
        'recorded',
        'void'
      )
    )
);

alter table public.giving_transactions enable row level security;

-- ==================================================
-- 20: 20260718072445_create_compliance_items.sql
-- ==================================================

create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  category text not null default 'other',
  due_date date,
  status text not null default 'open',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint compliance_items_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint compliance_items_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint compliance_items_category_valid
    check (
      category in (
        'federal_tax',
        'state_tax',
        'payroll',
        'charity_registration',
        'governance',
        'policy',
        'other'
      )
    ),

  constraint compliance_items_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint compliance_items_status_valid
    check (
      status in (
        'open',
        'completed',
        'not_applicable'
      )
    )
);

alter table public.compliance_items enable row level security;

-- ==================================================
-- 21: 20260718074200_create_exceptions.sql
-- ==================================================

create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_type text not null,
  source_id uuid,
  category text not null default 'other',
  severity text not null default 'medium',
  title text not null,
  description text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exceptions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint exceptions_source_type_not_blank
    check (char_length(btrim(source_type)) > 0),

  constraint exceptions_category_valid
    check (
      category in (
        'accounting',
        'banking',
        'bills',
        'expenses',
        'giving',
        'budgets',
        'compliance',
        'data_quality',
        'other'
      )
    ),

  constraint exceptions_severity_valid
    check (
      severity in (
        'low',
        'medium',
        'high',
        'critical'
      )
    ),

  constraint exceptions_title_not_blank
    check (char_length(btrim(title)) > 0),

  constraint exceptions_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint exceptions_status_valid
    check (
      status in (
        'open',
        'resolved',
        'dismissed'
      )
    )
);

alter table public.exceptions enable row level security;

-- ==================================================
-- 22: 20260718075930_create_audit_events.sql
-- ==================================================

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  event_type text not null,
  source_type text not null,
  source_id uuid,
  actor_type text not null default 'system',
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint audit_events_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint audit_events_event_type_not_blank
    check (char_length(btrim(event_type)) > 0),

  constraint audit_events_source_type_not_blank
    check (char_length(btrim(source_type)) > 0),

  constraint audit_events_actor_type_valid
    check (
      actor_type in (
        'system',
        'user',
        'integration'
      )
    ),

  constraint audit_events_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    )
);

alter table public.audit_events enable row level security;

-- ==================================================
-- 23: 20260718081700_create_audit_documents.sql
-- ==================================================

create table public.audit_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  audit_event_id uuid,
  name text not null,
  document_type text not null default 'other',
  document_date date,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint audit_documents_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint audit_documents_audit_event_id_fkey
    foreign key (audit_event_id)
    references public.audit_events(id)
    on delete set null,

  constraint audit_documents_name_not_blank
    check (char_length(btrim(name)) > 0),

  constraint audit_documents_document_type_valid
    check (
      document_type in (
        'financial',
        'banking',
        'giving',
        'compliance',
        'governance',
        'exception',
        'other'
      )
    ),

  constraint audit_documents_description_not_blank
    check (
      description is null
      or char_length(btrim(description)) > 0
    ),

  constraint audit_documents_status_valid
    check (
      status in (
        'active',
        'archived'
      )
    )
);

alter table public.audit_documents enable row level security;

-- ==================================================
-- 24: 20260718083430_create_reconciliations.sql
-- ==================================================

create table public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  statement_ending_balance numeric(18,2) not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliations_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint reconciliations_bank_account_id_fkey
    foreign key (bank_account_id)
    references public.bank_accounts(id)
    on delete restrict,

  constraint reconciliations_period_valid
    check (period_end >= period_start),

  constraint reconciliations_status_valid
    check (
      status in (
        'draft',
        'in_progress',
        'completed'
      )
    )
);

alter table public.reconciliations enable row level security;

-- ==================================================
-- 25: 20260718085200_create_reconciliation_items.sql
-- ==================================================

create table public.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  bank_transaction_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reconciliation_items_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint reconciliation_items_reconciliation_id_fkey
    foreign key (reconciliation_id)
    references public.reconciliations(id)
    on delete cascade,

  constraint reconciliation_items_bank_transaction_id_fkey
    foreign key (bank_transaction_id)
    references public.bank_transactions(id)
    on delete restrict,

  constraint reconciliation_items_reconciliation_transaction_unique
    unique (reconciliation_id, bank_transaction_id),

  constraint reconciliation_items_status_valid
    check (
      status in (
        'pending',
        'cleared',
        'excluded'
      )
    )
);

alter table public.reconciliation_items enable row level security;

-- ==================================================
-- 26: 20260718090930_create_bank_transaction_matches.sql
-- ==================================================

create table public.bank_transaction_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  bank_transaction_id uuid not null,
  source_type text not null,
  source_id uuid not null,
  matched_amount numeric(18,2) not null,
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bank_transaction_matches_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint bank_transaction_matches_bank_transaction_id_fkey
    foreign key (bank_transaction_id)
    references public.bank_transactions(id)
    on delete cascade,

  constraint bank_transaction_matches_source_type_valid
    check (
      source_type in (
        'bill_payment',
        'expense',
        'giving_transaction',
        'journal_entry'
      )
    ),

  constraint bank_transaction_matches_amount_positive
    check (matched_amount > 0),

  constraint bank_transaction_matches_source_unique
    unique (
      bank_transaction_id,
      source_type,
      source_id
    ),

  constraint bank_transaction_matches_status_valid
    check (
      status in (
        'proposed',
        'confirmed',
        'rejected'
      )
    )
);

alter table public.bank_transaction_matches enable row level security;

-- ==================================================
-- 27: 20260718092700_create_close_sessions.sql
-- ==================================================

create table public.close_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  accounting_period_id uuid not null,
  close_type text not null default 'month_end',
  status text not null default 'draft',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint close_sessions_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint close_sessions_accounting_period_id_fkey
    foreign key (accounting_period_id)
    references public.accounting_periods(id)
    on delete restrict,

  constraint close_sessions_close_type_valid
    check (
      close_type in (
        'month_end',
        'quarter_end',
        'year_end'
      )
    ),

  constraint close_sessions_status_valid
    check (
      status in (
        'draft',
        'in_progress',
        'completed'
      )
    ),

  constraint close_sessions_completion_time_valid
    check (
      completed_at is null
      or started_at is not null
    )
);

alter table public.close_sessions enable row level security;

-- ==================================================
-- 28: 20260718163400_create_close_tasks.sql
-- ==================================================

create table public.close_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  close_session_id uuid not null,
  task_type text not null,
  title text not null,
  description text,
  status text not null default 'pending',
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint close_tasks_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade,

  constraint close_tasks_close_session_id_fkey
    foreign key (close_session_id)
    references public.close_sessions(id)
    on delete cascade,

  constraint close_tasks_task_type_valid
    check (
      task_type in (
        'reconciliation',
        'transaction_review',
        'exception_review',
        'giving_review',
        'bill_review',
        'expense_review',
        'journal_review',
        'compliance_review',
        'fund_review',
        'accrual_review'
      )
    ),

  constraint close_tasks_status_valid
    check (
      status in (
        'pending',
        'in_progress',
        'completed',
        'skipped'
      )
    ),

  constraint close_tasks_completion_time_valid
    check (
      completed_at is null
      or status = 'completed'
    ),

  constraint close_tasks_sort_order_nonnegative
    check (
      sort_order >= 0
    )
);

alter table public.close_tasks enable row level security;

commit;
