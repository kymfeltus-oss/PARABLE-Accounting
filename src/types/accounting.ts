/** One row in parable_ledger.chart_of_accounts (list views). */
export type CoaListRow = {
  id: string;
  account_code: number;
  account_name: string;
  category: string;
  sub_category: string | null;
  account_type: string | null;
  is_restricted: boolean;
};

export type AccountingAlertRow = {
  account_code: number;
  account_name: string;
  health_status: string;
  normal_balance: string;
  tenant_id?: string;
};

export type LiveLedgerFeedRow = {
  id: string;
  tenant_id: string;
  created_at: string;
  account_code: number;
  account_name: string | null;
  debit: number;
  credit: number;
  narrative: string | null;
  journal_entry_id: string;
};
