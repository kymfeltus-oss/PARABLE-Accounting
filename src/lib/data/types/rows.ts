export type AuditEventRow = {
  id: string;
  organization_id: string;
  event_type: string;
  source_type: string;
  source_id: string | null;
  actor_type: string;
  actor_user_id: string | null;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

export type AuditDocumentRow = {
  id: string;
  organization_id: string;
  audit_event_id: string | null;
  name: string;
  document_type: string;
  document_date: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type OrganizationMembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ExceptionRow = {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string | null;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ComplianceItemRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  due_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type BillRow = {
  id: string;
  organization_id: string;
  vendor_id: string;
  bill_number: string | null;
  bill_date: string;
  due_date: string | null;
  description: string | null;
  total_amount: number | string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type VendorRow = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tax_id_last_four: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CloseTaskRow = {
  id: string;
  organization_id: string;
  close_session_id: string;
  task_type: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CloseSessionRow = {
  id: string;
  organization_id: string;
  accounting_period_id: string;
  close_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GivingTransactionRow = {
  id: string;
  organization_id: string;
  member_id: string | null;
  fund_id: string | null;
  transaction_date: string;
  amount: number | string;
  giving_method: string;
  reference: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FundRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  fund_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MemberRow = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BankAccountRow = {
  id: string;
  organization_id: string;
  account_id: string;
  name: string;
  institution_name: string | null;
  account_type: string;
  last_four: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BankTransactionRow = {
  id: string;
  organization_id: string;
  bank_account_id: string;
  transaction_date: string;
  posted_date: string | null;
  description: string;
  amount: number | string;
  reference: string | null;
  source_type: string;
  external_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BankTransactionMatchRow = {
  id: string;
  organization_id: string;
  bank_transaction_id: string;
  source_type: string;
  source_id: string;
  matched_amount: number | string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ExpenseRow = {
  id: string;
  organization_id: string;
  vendor_id: string | null;
  expense_date: string;
  description: string;
  total_amount: number | string;
  reference: string | null;
  payment_source: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AmountRow = {
  amount: number | string;
};

export type BudgetRow = {
  id: string;
  organization_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BudgetLineRow = {
  id: string;
  budget_id: string;
  account_id: string;
  fund_id: string | null;
  line_number: number;
  description: string | null;
  amount: number | string;
  created_at: string;
  updated_at: string;
};

export type AccountRow = {
  id: string;
  organization_id: string;
  parent_account_id: string | null;
  code: string;
  name: string;
  account_type: string;
  is_posting: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AccountingPeriodRow = {
  id: string;
  organization_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type JournalEntryRow = {
  id: string;
  organization_id: string;
  accounting_period_id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  source_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type JournalEntryLineRow = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  fund_id: string | null;
  line_number: number;
  description: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
  created_at: string;
  updated_at: string;
};
