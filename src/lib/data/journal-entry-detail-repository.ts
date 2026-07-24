import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { mapDatabaseSourceType } from "./journal-register-repository";
import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type {
  AccountRow,
  AccountingPeriodRow,
  FundRow,
  JournalEntryLineRow,
  JournalEntryRow,
} from "./types/rows";

export type JournalEntryDetailLineRecord = {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountName: string;
  description: string | null;
  debit: number;
  credit: number;
  fundCode: string | null;
  fundName: string | null;
};

export type JournalEntryDetailReversalRelation = {
  isReversal: boolean;
  isReversed: boolean;
  relatedJournalEntryId: string | null;
  relatedEntryNumber: string | null;
  reversalDate: string | null;
  reversalReason: string | null;
};

export type JournalEntryDetailRecord = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source:
    | "expense"
    | "giving"
    | "manual"
    | "banking"
    | "opening_balance"
    | "reversal"
    | "other";
  sourceReference: string | null;
  periodName: string | null;
  status: "draft" | "posted" | "reversed" | "void";
  lines: JournalEntryDetailLineRecord[];
  reversal: JournalEntryDetailReversalRelation;
  voidReason: string | null;
};

type JournalEntryDetailJournalRow = Pick<
  JournalEntryRow,
  | "id"
  | "organization_id"
  | "accounting_period_id"
  | "entry_number"
  | "entry_date"
  | "description"
  | "source_type"
  | "status"
> & {
  source_id: string | null;
  reverses_journal_entry_id: string | null;
  reversal_reason: string | null;
  void_reason: string | null;
};

type ExpenseReferenceRow = {
  id: string;
  reference: string | null;
};

function requireJournalEntryId(
  journalEntryId: string,
  operation: string,
): string {
  const trimmed = journalEntryId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "journalEntryId is required and must be a non-empty string",
    });
  }

  return trimmed;
}

function normalizeAmount(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function isJournalStatus(
  value: string,
): value is JournalEntryDetailRecord["status"] {
  return (
    value === "draft" ||
    value === "posted" ||
    value === "reversed" ||
    value === "void"
  );
}

function sortLinesByLineNumber(
  lines: JournalEntryDetailLineRecord[],
): JournalEntryDetailLineRecord[] {
  return [...lines].sort((left, right) => left.lineNumber - right.lineNumber);
}

export async function getJournalEntryDetail(
  organizationId: string,
  journalEntryId: string,
): Promise<JournalEntryDetailRecord | null> {
  const operation = "getJournalEntryDetail";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedJournalEntryId = requireJournalEntryId(journalEntryId, operation);
  const supabase = await createServerSupabaseClient();

  const journalResult = await supabase
    .from("journal_entries")
    .select(
      "id, organization_id, accounting_period_id, entry_number, entry_date, description, source_type, source_id, status, reverses_journal_entry_id, reversal_reason, void_reason",
    )
    .eq("id", scopedJournalEntryId)
    .eq("organization_id", scopedOrganizationId);

  const journals = unwrapRows<JournalEntryDetailJournalRow>(
    `${operation}.journal`,
    journalResult,
  ).filter((journal) => journal.organization_id === scopedOrganizationId);

  if (journals.length === 0) {
    return null;
  }

  const journal = journals[0];

  if (journal.organization_id !== scopedOrganizationId) {
    return null;
  }

  if (!isJournalStatus(journal.status)) {
    throw new DataAccessError({
      operation,
      message: `Unexpected journal entry status: ${journal.status}`,
    });
  }

  const linesResult = await supabase
    .from("journal_entry_lines")
    .select(
      "id, journal_entry_id, account_id, fund_id, line_number, description, debit_amount, credit_amount",
    )
    .eq("journal_entry_id", journal.id)
    .order("line_number", { ascending: true });

  const lineRows = unwrapRows<
    Pick<
      JournalEntryLineRow,
      | "id"
      | "journal_entry_id"
      | "account_id"
      | "fund_id"
      | "line_number"
      | "description"
      | "debit_amount"
      | "credit_amount"
    >
  >(`${operation}.lines`, linesResult).filter(
    (line) => line.journal_entry_id === journal.id,
  );

  const accountIds = [...new Set(lineRows.map((line) => line.account_id))];
  const fundIds = [
    ...new Set(
      lineRows
        .map((line) => line.fund_id)
        .filter((fundId): fundId is string => fundId != null),
    ),
  ];

  const [
    periodResult,
    accountsResult,
    fundsResult,
    expensesResult,
    reversalOfOriginalResult,
    originalForReversalResult,
  ] = await Promise.all([
    supabase
      .from("accounting_periods")
      .select("id, name, organization_id")
      .eq("id", journal.accounting_period_id)
      .eq("organization_id", scopedOrganizationId),
    accountIds.length > 0
      ? supabase
          .from("accounts")
          .select("id, organization_id, code, name")
          .eq("organization_id", scopedOrganizationId)
          .in("id", accountIds)
      : Promise.resolve({ data: [], error: null }),
    fundIds.length > 0
      ? supabase
          .from("funds")
          .select("id, organization_id, code, name")
          .eq("organization_id", scopedOrganizationId)
          .in("id", fundIds)
      : Promise.resolve({ data: [], error: null }),
    journal.source_type === "expense" && journal.source_id
      ? supabase
          .from("expenses")
          .select("id, reference")
          .eq("organization_id", scopedOrganizationId)
          .eq("id", journal.source_id)
      : Promise.resolve({ data: [], error: null }),
    journal.source_type !== "reversal"
      ? supabase
          .from("journal_entries")
          .select(
            "id, entry_number, entry_date, reversal_reason, organization_id",
          )
          .eq("organization_id", scopedOrganizationId)
          .eq("reverses_journal_entry_id", journal.id)
      : Promise.resolve({ data: [], error: null }),
    journal.reverses_journal_entry_id
      ? supabase
          .from("journal_entries")
          .select("id, entry_number, organization_id")
          .eq("organization_id", scopedOrganizationId)
          .eq("id", journal.reverses_journal_entry_id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const periods = unwrapRows<
    Pick<AccountingPeriodRow, "id" | "name" | "organization_id">
  >(`${operation}.period`, periodResult).filter(
    (period) => period.organization_id === scopedOrganizationId,
  );
  const accounts = unwrapRows<
    Pick<AccountRow, "id" | "organization_id" | "code" | "name">
  >(`${operation}.accounts`, accountsResult).filter(
    (account) => account.organization_id === scopedOrganizationId,
  );
  const funds = unwrapRows<
    Pick<FundRow, "id" | "organization_id" | "code" | "name">
  >(`${operation}.funds`, fundsResult).filter(
    (fund) => fund.organization_id === scopedOrganizationId,
  );
  const expenses = unwrapRows<ExpenseReferenceRow>(
    `${operation}.expenses`,
    expensesResult,
  );
  const reversalOfOriginal = unwrapRows<{
    id: string;
    entry_number: string;
    entry_date: string;
    reversal_reason: string | null;
    organization_id: string;
  }>(`${operation}.reversalOfOriginal`, reversalOfOriginalResult).filter(
    (row) => row.organization_id === scopedOrganizationId,
  );
  const originalForReversal = unwrapRows<{
    id: string;
    entry_number: string;
    organization_id: string;
  }>(`${operation}.originalForReversal`, originalForReversalResult).filter(
    (row) => row.organization_id === scopedOrganizationId,
  );

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const fundById = new Map(funds.map((fund) => [fund.id, fund]));
  const sourceReference =
    journal.source_type === "expense" && journal.source_id
      ? expenses.find((expense) => expense.id === journal.source_id)?.reference ??
        null
      : null;

  const lines = sortLinesByLineNumber(
    lineRows.map((line) => {
      const account = accountById.get(line.account_id);
      const fund = line.fund_id ? fundById.get(line.fund_id) : null;

      return {
        id: line.id,
        lineNumber: line.line_number,
        accountCode: account?.code ?? "",
        accountName: account?.name ?? "",
        description: line.description,
        debit: normalizeAmount(line.debit_amount),
        credit: normalizeAmount(line.credit_amount),
        fundCode: fund?.code ?? null,
        fundName: fund?.name ?? null,
      };
    }),
  );

  const isReversal =
    journal.source_type === "reversal" ||
    journal.reverses_journal_entry_id != null;
  const linkedReversal = reversalOfOriginal[0] ?? null;
  const linkedOriginal = originalForReversal[0] ?? null;

  const reversal: JournalEntryDetailReversalRelation = isReversal
    ? {
        isReversal: true,
        isReversed: false,
        relatedJournalEntryId: linkedOriginal?.id ?? journal.reverses_journal_entry_id,
        relatedEntryNumber: linkedOriginal?.entry_number ?? null,
        reversalDate: journal.entry_date,
        reversalReason: journal.reversal_reason,
      }
    : {
        isReversal: false,
        isReversed:
          journal.status === "reversed" || linkedReversal != null,
        relatedJournalEntryId: linkedReversal?.id ?? null,
        relatedEntryNumber: linkedReversal?.entry_number ?? null,
        reversalDate: linkedReversal?.entry_date ?? null,
        reversalReason: linkedReversal?.reversal_reason ?? null,
      };

  return {
    id: journal.id,
    entryNumber: journal.entry_number,
    entryDate: journal.entry_date,
    description: journal.description,
    source:
      journal.source_type === "reversal"
        ? "reversal"
        : mapDatabaseSourceType(journal.source_type),
    sourceReference,
    periodName: periods[0]?.name ?? null,
    status: journal.status,
    lines,
    reversal,
    voidReason: journal.void_reason,
  };
}
