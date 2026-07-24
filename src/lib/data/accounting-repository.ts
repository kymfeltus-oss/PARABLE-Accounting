import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import {
  buildAccountBalanceMap,
  buildTrialBalance,
  type TrialBalanceReport,
} from "./ledger-balances";
import { loadLedgerBalanceContext } from "./ledger-balances-repository";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type {
  AccountingPeriodRow,
  AccountRow,
  JournalEntryRow,
} from "./types/rows";

type JournalEntryLineAggregationRow = {
  journal_entry_id: string;
  debit_amount: number | string;
  credit_amount: number | string;
};

export type JournalEntryRecord = JournalEntryRow & {
  lineCount: number;
  debitTotal: number;
  creditTotal: number;
  isBalanced: boolean;
};

export type AccountingPeriodRecord = AccountingPeriodRow & {
  isCurrent: boolean;
};

export type AccountRecord = AccountRow & {
  balance: number;
};

export type AccountingData = {
  organizationId: string;
  accounts: AccountRecord[];
  periods: AccountingPeriodRecord[];
  journalEntries: JournalEntryRecord[];
  trialBalance: TrialBalanceReport;
  asOfDate: string;
  counts: {
    totalAccounts: number;
    activeAccounts: number;
    openPeriods: number;
    closedPeriods: number;
    postedJournalEntries: number;
    draftJournalEntries: number;
  };
};

export type CreateAccountInput = {
  code: string;
  name: string;
  accountType: string;
  isPosting?: boolean | null;
};

export type UpdateAccountInput = {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  isPosting?: boolean | null;
  status?: string | null;
};

export type CreateAccountingPeriodInput = {
  name: string;
  startDate: string;
  endDate: string;
};

function requireNonEmptyField(
  value: string,
  field: string,
  operation: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: `${field} is required`,
    });
  }

  return trimmed;
}

function toAccountingPeriodRecord(
  period: AccountingPeriodRow,
  today: string = getTodayDateString(),
): AccountingPeriodRecord {
  return {
    ...period,
    isCurrent: isCurrentPeriod(period, today),
  };
}

type JournalEntryMetrics = {
  lineCount: number;
  debitTotal: number;
  creditTotal: number;
  isBalanced: boolean;
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentPeriod(period: AccountingPeriodRow, today: string): boolean {
  return (
    period.status === "open" &&
    period.start_date <= today &&
    period.end_date >= today
  );
}

function attachPeriodCurrentFlag(
  periods: AccountingPeriodRow[],
  today: string,
): AccountingPeriodRecord[] {
  return periods.map((period) => ({
    ...period,
    isCurrent: isCurrentPeriod(period, today),
  }));
}

function createEmptyJournalEntryMetrics(): JournalEntryMetrics {
  return {
    lineCount: 0,
    debitTotal: 0,
    creditTotal: 0,
    isBalanced: true,
  };
}

function normalizeAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function buildJournalEntryMetrics(
  lines: JournalEntryLineAggregationRow[],
): Map<string, JournalEntryMetrics> {
  const metrics = new Map<string, JournalEntryMetrics>();

  for (const line of lines) {
    const current = metrics.get(line.journal_entry_id) ?? {
      lineCount: 0,
      debitTotal: 0,
      creditTotal: 0,
      isBalanced: true,
    };

    current.lineCount += 1;
    current.debitTotal += normalizeAmount(line.debit_amount);
    current.creditTotal += normalizeAmount(line.credit_amount);
    metrics.set(line.journal_entry_id, current);
  }

  for (const [entryId, entryMetrics] of metrics.entries()) {
    metrics.set(entryId, {
      ...entryMetrics,
      isBalanced: entryMetrics.debitTotal === entryMetrics.creditTotal,
    });
  }

  return metrics;
}

function attachJournalEntryMetrics(
  journalEntries: JournalEntryRow[],
  metrics: Map<string, JournalEntryMetrics>,
): JournalEntryRecord[] {
  return journalEntries.map((entry) => {
    const entryMetrics =
      metrics.get(entry.id) ?? createEmptyJournalEntryMetrics();

    return {
      ...entry,
      lineCount: entryMetrics.lineCount,
      debitTotal: entryMetrics.debitTotal,
      creditTotal: entryMetrics.creditTotal,
      isBalanced: entryMetrics.isBalanced,
    };
  });
}

export async function getAccountingData(
  organizationId: string,
): Promise<AccountingData> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "getAccountingData",
  );
  const supabase = await createServerSupabaseClient();

  const [accountsResult, periodsResult, journalEntriesResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("code", { ascending: true }),
      supabase
        .from("accounting_periods")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("start_date", { ascending: false }),
      supabase
        .from("journal_entries")
        .select("*")
        .eq("organization_id", scopedOrganizationId)
        .order("entry_date", { ascending: false }),
    ]);

  const accounts = unwrapRows<AccountRow>(
    "getAccountingData.accounts",
    accountsResult,
  );
  const periods = unwrapRows<AccountingPeriodRow>(
    "getAccountingData.periods",
    periodsResult,
  );
  const journalEntries = unwrapRows<JournalEntryRow>(
    "getAccountingData.journalEntries",
    journalEntriesResult,
  );

  const journalEntryIds = journalEntries.map((entry) => entry.id);
  let journalLines: JournalEntryLineAggregationRow[] = [];

  if (journalEntryIds.length > 0) {
    const journalEntryIdSet = new Set(journalEntryIds);
    const journalLinesResult = await supabase
      .from("journal_entry_lines")
      .select("journal_entry_id, debit_amount, credit_amount")
      .in("journal_entry_id", journalEntryIds);
    journalLines = unwrapRows<JournalEntryLineAggregationRow>(
      "getAccountingData.journalLines",
      journalLinesResult,
    ).filter((line) => journalEntryIdSet.has(line.journal_entry_id));
  }

  const journalMetrics = buildJournalEntryMetrics(journalLines);
  const journalEntryRecords = attachJournalEntryMetrics(
    journalEntries,
    journalMetrics,
  );
  const asOfDate = getTodayDateString();
  const periodRecords = attachPeriodCurrentFlag(periods, asOfDate);

  const ledgerContext = await loadLedgerBalanceContext(scopedOrganizationId, {
    asOfDate,
  });
  const accountBalanceMap = buildAccountBalanceMap(
    ledgerContext.lines,
    ledgerContext.accounts,
    asOfDate,
  );
  const accountRecords: AccountRecord[] = accounts.map((account) => ({
    ...account,
    balance: accountBalanceMap.get(account.id) ?? 0,
  }));
  const trialBalance = buildTrialBalance(
    ledgerContext.lines,
    ledgerContext.accounts,
    asOfDate,
  );

  return {
    organizationId: scopedOrganizationId,
    accounts: accountRecords,
    periods: periodRecords,
    journalEntries: journalEntryRecords,
    trialBalance,
    asOfDate,
    counts: {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((account) => account.status === "active")
        .length,
      openPeriods: periods.filter((period) => period.status === "open").length,
      closedPeriods: periods.filter((period) => period.status === "closed")
        .length,
      postedJournalEntries: journalEntries.filter(
        (entry) => entry.status === "posted",
      ).length,
      draftJournalEntries: journalEntries.filter(
        (entry) => entry.status === "draft",
      ).length,
    },
  };
}

export async function createAccount(
  organizationId: string,
  input: CreateAccountInput,
): Promise<AccountRow> {
  const operation = "createAccount";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const accountCode = requireNonEmptyField(input.code, "code", operation);
  const accountName = requireNonEmptyField(input.name, "name", operation);
  const accountType = requireNonEmptyField(
    input.accountType,
    "accountType",
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_account", {
    target_organization_id: scopedOrganizationId,
    account_code: accountCode,
    account_name: accountName,
    account_type: accountType,
    is_posting: input.isPosting ?? true,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createAccount RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Account creation returned no row",
    });
  }

  return result.data as AccountRow;
}

export async function updateAccount(
  organizationId: string,
  input: UpdateAccountInput,
): Promise<AccountRow> {
  const operation = "updateAccount";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const accountCode = requireNonEmptyField(input.code, "code", operation);
  const accountName = requireNonEmptyField(input.name, "name", operation);
  const accountType = requireNonEmptyField(
    input.accountType,
    "accountType",
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("update_account", {
    target_organization_id: scopedOrganizationId,
    target_account_id: input.accountId,
    account_code: accountCode,
    account_name: accountName,
    account_type: accountType,
    is_posting: input.isPosting ?? true,
    account_status: input.status ?? null,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[updateAccount RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Account update returned no row",
    });
  }

  return result.data as AccountRow;
}

export async function createAccountingPeriod(
  organizationId: string,
  input: CreateAccountingPeriodInput,
): Promise<AccountingPeriodRecord> {
  const operation = "createAccountingPeriod";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const periodName = requireNonEmptyField(input.name, "name", operation);
  const startDate = requireNonEmptyField(
    input.startDate,
    "startDate",
    operation,
  );
  const endDate = requireNonEmptyField(input.endDate, "endDate", operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("create_accounting_period", {
    target_organization_id: scopedOrganizationId,
    period_name: periodName,
    period_start_date: startDate,
    period_end_date: endDate,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createAccountingPeriod RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Accounting period creation returned no row",
    });
  }

  return toAccountingPeriodRecord(result.data as AccountingPeriodRow);
}

export async function closeAccountingPeriod(
  organizationId: string,
  periodId: string,
): Promise<AccountingPeriodRecord> {
  const operation = "closeAccountingPeriod";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("close_accounting_period", {
    target_organization_id: scopedOrganizationId,
    target_period_id: periodId,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[closeAccountingPeriod RPC diagnostic]", {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Accounting period close returned no row",
    });
  }

  return toAccountingPeriodRecord(result.data as AccountingPeriodRow);
}
