export type DashboardPeriod = "July 2026" | "June 2026";
export type ReportingBasis = "Accrual" | "Cash";
export type BooksStatus = "Open" | "Closed";
export type ChartRange = "7D" | "30D" | "90D" | "YTD";
export type KpiAccent = "blue" | "cyan" | "amber" | "violet";
export type AttentionPriority = "critical" | "high" | "medium" | "informational";
export type ExpenseStatus = "recorded" | "draft" | "needs-allocation";

export type ActivityPoint = {
  label: string;
  giving: number;
  expenses: number;
};

export type DashboardKpi = {
  id: string;
  label: string;
  value: number | null;
  supportingText: string;
  trend?: { direction: "up" | "down"; value: number; label: string };
  accent: KpiAccent;
  points?: number[];
};

export type FundHealthItem = {
  id: string;
  name: string;
  type: "Restricted" | "Unrestricted";
  balance: number;
  proportion: number;
};

export type AttentionItem = {
  id: string;
  title: string;
  description: string;
  priority: AttentionPriority;
  actionLabel: string;
  href: string;
};

export type RecentExpense = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: ExpenseStatus;
};

export type AccountingStatus = {
  id: string;
  label: string;
  value: string;
  status: string;
  progress?: number;
};

export type DashboardPeriodData = {
  period: DashboardPeriod;
  kpis: DashboardKpi[];
  activity: Record<ChartRange, ActivityPoint[]>;
  recentExpenses: RecentExpense[];
  periodStatus: BooksStatus;
  aiInsight: string;
};

export type TransactionDraft = {
  transactionType: string;
  date: string;
  payee: string;
  account: string;
  fund: string;
  amount: string;
  memo: string;
  referenceNumber: string;
  debitAccount: string;
  creditAccount: string;
};

export type TransactionErrors = Partial<Record<keyof TransactionDraft, string>>;
