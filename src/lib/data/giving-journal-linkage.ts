import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountingPeriodRow, JournalEntryRow } from "./types/rows";

export type GivingJournalLinkage = {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  status: "posted" | "draft" | "reversed" | "void";
  totalDebit: number;
  totalCredit: number;
  periodName: string | null;
  sourceReference: string | null;
};

type GivingJournalLinkageRow = {
  id: string;
  organization_id: string;
  status: string;
  journal_entry_id: string | null;
  reference: string | null;
};

type JournalEntryLineTotalRow = {
  journal_entry_id: string;
  debit_amount: number | string;
  credit_amount: number | string;
};

function requireGivingTransactionId(
  givingTransactionId: string,
  operation: string,
): string {
  const trimmed = givingTransactionId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "givingTransactionId is required and must be a non-empty string",
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
): value is GivingJournalLinkage["status"] {
  return (
    value === "posted" ||
    value === "draft" ||
    value === "reversed" ||
    value === "void"
  );
}

function sumJournalLineTotals(lines: JournalEntryLineTotalRow[]): {
  totalDebit: number;
  totalCredit: number;
} {
  return lines.reduce(
    (totals, line) => ({
      totalDebit: totals.totalDebit + normalizeAmount(line.debit_amount),
      totalCredit: totals.totalCredit + normalizeAmount(line.credit_amount),
    }),
    { totalDebit: 0, totalCredit: 0 },
  );
}

export async function getGivingJournalLinkage(
  organizationId: string,
  givingTransactionId: string,
): Promise<GivingJournalLinkage | null> {
  const operation = "getGivingJournalLinkage";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedGivingTransactionId = requireGivingTransactionId(
    givingTransactionId,
    operation,
  );
  const supabase = await createServerSupabaseClient();

  const givingResult = await supabase
    .from("giving_transactions")
    .select("id, organization_id, status, journal_entry_id, reference")
    .eq("id", scopedGivingTransactionId)
    .eq("organization_id", scopedOrganizationId);

  const transactions = unwrapRows<GivingJournalLinkageRow>(
    `${operation}.givingTransaction`,
    givingResult,
  );

  if (transactions.length === 0) {
    return null;
  }

  const transaction = transactions[0];

  if (transaction.status !== "recorded" || transaction.journal_entry_id == null) {
    return null;
  }

  const journalEntryId = transaction.journal_entry_id;

  const journalResult = await supabase
    .from("journal_entries")
    .select(
      "id, organization_id, accounting_period_id, entry_number, entry_date, status",
    )
    .eq("id", journalEntryId)
    .eq("organization_id", scopedOrganizationId);

  const journals = unwrapRows<
    Pick<
      JournalEntryRow,
      | "id"
      | "organization_id"
      | "accounting_period_id"
      | "entry_number"
      | "entry_date"
      | "status"
    >
  >(`${operation}.journal`, journalResult);

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

  const periodResult = await supabase
    .from("accounting_periods")
    .select("name")
    .eq("id", journal.accounting_period_id)
    .eq("organization_id", scopedOrganizationId);

  const periods = unwrapRows<Pick<AccountingPeriodRow, "name">>(
    `${operation}.period`,
    periodResult,
  );
  const periodName = periods[0]?.name ?? null;

  const linesResult = await supabase
    .from("journal_entry_lines")
    .select("journal_entry_id, debit_amount, credit_amount")
    .eq("journal_entry_id", journal.id);

  const lines = unwrapRows<JournalEntryLineTotalRow>(
    `${operation}.lines`,
    linesResult,
  ).filter((line) => line.journal_entry_id === journal.id);

  const { totalDebit, totalCredit } = sumJournalLineTotals(lines);

  return {
    journalEntryId: journal.id,
    entryNumber: journal.entry_number,
    entryDate: journal.entry_date,
    status: journal.status,
    totalDebit,
    totalCredit,
    periodName,
    sourceReference: transaction.reference,
  };
}
