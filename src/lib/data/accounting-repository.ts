import { createServerSupabaseClient } from "@/lib/supabase/server";

import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
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

export type AccountingData = {
  organizationId: string;
  accounts: AccountRow[];
  periods: AccountingPeriodRecord[];
  journalEntries: JournalEntryRecord[];
  counts: {
    totalAccounts: number;
    activeAccounts: number;
    openPeriods: number;
    closedPeriods: number;
    postedJournalEntries: number;
    draftJournalEntries: number;
  };
};

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
  const periodRecords = attachPeriodCurrentFlag(periods, getTodayDateString());

  return {
    organizationId: scopedOrganizationId,
    accounts,
    periods: periodRecords,
    journalEntries: journalEntryRecords,
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
