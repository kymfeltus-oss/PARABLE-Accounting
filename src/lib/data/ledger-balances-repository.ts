import { createServerSupabaseClient } from "@/lib/supabase/server";

import type {
  AccountInfo,
  BalanceSheetReport,
  FundBalanceReport,
  FundInfo,
  IncomeStatementReport,
  LedgerLineInput,
  TrialBalanceReport,
} from "./ledger-balances";
import {
  buildBalanceSheet,
  buildFundBalanceReport,
  buildIncomeStatement,
  buildTrialBalance,
} from "./ledger-balances";
import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { getYearToDateRange, unwrapRows } from "./query-helpers";
import type { AccountRow, FundRow, JournalEntryRow } from "./types/rows";

/** Supabase default max rows; page until a short page is returned. */
const JOURNAL_LINE_PAGE_SIZE = 1000;
/** Keep `.in()` URL payloads bounded. */
const JOURNAL_ENTRY_ID_CHUNK_SIZE = 100;

type PostedJournalEntryRow = Pick<
  JournalEntryRow,
  "id" | "status" | "entry_date"
>;

type JournalEntryLineRow = {
  journal_entry_id: string;
  account_id: string;
  fund_id: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
};

export type LedgerBalanceContext = {
  organizationId: string;
  asOfDate: string;
  periodStartDate: string;
  periodEndDate: string;
  lines: LedgerLineInput[];
  accounts: AccountInfo[];
  funds: FundInfo[];
};

export type FinancialReports = {
  asOfDate: string;
  periodStartDate: string;
  periodEndDate: string;
  trialBalance: TrialBalanceReport;
  balanceSheet: BalanceSheetReport;
  incomeStatement: IncomeStatementReport;
  fundBalance: FundBalanceReport;
};

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function toAccountInfo(account: AccountRow): AccountInfo {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    accountType: account.account_type as AccountInfo["accountType"],
  };
}

function toFundInfo(fund: FundRow): FundInfo {
  return {
    id: fund.id,
    name: fund.name,
    code: fund.code,
  };
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}

async function loadPostedJournalLines(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  postedEntryIds: string[],
): Promise<JournalEntryLineRow[]> {
  const postedEntryIdSet = new Set(postedEntryIds);
  const journalLines: JournalEntryLineRow[] = [];

  for (const entryIdChunk of chunkIds(
    postedEntryIds,
    JOURNAL_ENTRY_ID_CHUNK_SIZE,
  )) {
    let from = 0;

    for (;;) {
      const to = from + JOURNAL_LINE_PAGE_SIZE - 1;
      const journalLinesResult = await supabase
        .from("journal_entry_lines")
        .select(
          "journal_entry_id, account_id, fund_id, debit_amount, credit_amount",
        )
        .in("journal_entry_id", entryIdChunk)
        .order("journal_entry_id", { ascending: true })
        .order("account_id", { ascending: true })
        .range(from, to);

      const page = unwrapRows<JournalEntryLineRow>(
        "loadLedgerBalanceContext.journalLines",
        journalLinesResult,
      ).filter((line) => postedEntryIdSet.has(line.journal_entry_id));

      journalLines.push(...page);

      if (page.length > JOURNAL_LINE_PAGE_SIZE) {
        throw new DataAccessError({
          operation: "loadLedgerBalanceContext.journalLines",
          message:
            "Posted journal line page exceeded the expected page size.",
        });
      }

      if (page.length < JOURNAL_LINE_PAGE_SIZE) {
        break;
      }

      from += JOURNAL_LINE_PAGE_SIZE;
    }
  }

  return journalLines;
}

function buildLedgerLines(
  postedEntries: PostedJournalEntryRow[],
  journalLines: JournalEntryLineRow[],
  accountById: Map<string, AccountInfo>,
): LedgerLineInput[] {
  const entryDateById = new Map(
    postedEntries.map((entry) => [entry.id, entry.entry_date]),
  );

  const lines: LedgerLineInput[] = [];

  for (const line of journalLines) {
    const entryDate = entryDateById.get(line.journal_entry_id);

    if (!entryDate) {
      continue;
    }

    const account = accountById.get(line.account_id);

    if (!account) {
      continue;
    }

    lines.push({
      journalEntryId: line.journal_entry_id,
      entryDate,
      accountId: line.account_id,
      accountType: account.accountType,
      accountCode: account.code,
      accountName: account.name,
      fundId: line.fund_id,
      debitAmount: normalizeAmount(line.debit_amount),
      creditAmount: normalizeAmount(line.credit_amount),
    });
  }

  return lines;
}

export async function loadLedgerBalanceContext(
  organizationId: string,
  options?: {
    asOfDate?: string;
    periodStartDate?: string;
    periodEndDate?: string;
  },
): Promise<LedgerBalanceContext> {
  const scopedOrganizationId = requireOrganizationId(
    organizationId,
    "loadLedgerBalanceContext",
  );
  const supabase = await createServerSupabaseClient();
  const asOfDate = options?.asOfDate ?? getTodayDateString();
  const { startDate: defaultStart, endDate: defaultEnd } = getYearToDateRange(
    new Date(`${asOfDate}T12:00:00.000Z`),
  );
  const periodStartDate = options?.periodStartDate ?? defaultStart;
  const periodEndDate = options?.periodEndDate ?? defaultEnd;

  const [journalEntriesResult, accountsResult, fundsResult] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, status, entry_date")
      .eq("organization_id", scopedOrganizationId)
      .eq("status", "posted"),
    supabase
      .from("accounts")
      .select("id, code, name, account_type")
      .eq("organization_id", scopedOrganizationId),
    supabase
      .from("funds")
      .select("id, name, code")
      .eq("organization_id", scopedOrganizationId),
  ]);

  const postedEntries = unwrapRows<PostedJournalEntryRow>(
    "loadLedgerBalanceContext.journalEntries",
    journalEntriesResult,
  );
  const accounts = unwrapRows<Pick<AccountRow, "id" | "code" | "name" | "account_type">>(
    "loadLedgerBalanceContext.accounts",
    accountsResult,
  );
  const funds = unwrapRows<Pick<FundRow, "id" | "name" | "code">>(
    "loadLedgerBalanceContext.funds",
    fundsResult,
  );

  const accountInfos = accounts.map((account) =>
    toAccountInfo(account as AccountRow),
  );
  const accountById = new Map(accountInfos.map((account) => [account.id, account]));
  const fundInfos = funds.map((fund) => toFundInfo(fund as FundRow));

  const postedEntryIds = postedEntries.map((entry) => entry.id);
  const journalLines =
    postedEntryIds.length > 0
      ? await loadPostedJournalLines(supabase, postedEntryIds)
      : [];

  const lines = buildLedgerLines(postedEntries, journalLines, accountById);

  return {
    organizationId: scopedOrganizationId,
    asOfDate,
    periodStartDate,
    periodEndDate,
    lines,
    accounts: accountInfos,
    funds: fundInfos,
  };
}

export function buildFinancialReportsFromContext(
  context: LedgerBalanceContext,
): FinancialReports {
  const { lines, accounts, funds, asOfDate, periodStartDate, periodEndDate } =
    context;

  return {
    asOfDate,
    periodStartDate,
    periodEndDate,
    trialBalance: buildTrialBalance(lines, accounts, asOfDate),
    balanceSheet: buildBalanceSheet(lines, accounts, asOfDate),
    incomeStatement: buildIncomeStatement(
      lines,
      accounts,
      periodStartDate,
      periodEndDate,
    ),
    fundBalance: buildFundBalanceReport(lines, funds, asOfDate),
  };
}

export async function loadFinancialReports(
  organizationId: string,
  options?: {
    asOfDate?: string;
    periodStartDate?: string;
    periodEndDate?: string;
  },
): Promise<FinancialReports> {
  const context = await loadLedgerBalanceContext(organizationId, options);
  return buildFinancialReportsFromContext(context);
}
