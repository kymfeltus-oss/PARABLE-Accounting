import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { unwrapRows } from "./query-helpers";
import type { AccountingPeriodRow, JournalEntryRow } from "./types/rows";

export type ExpenseJournalLinkage = {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  status: "posted" | "draft" | "reversed";
  totalDebit: number;
  totalCredit: number;
  periodName: string | null;
  sourceReference: string | null;
};

type ExpenseJournalLinkageExpenseRow = {
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

function requireExpenseId(expenseId: string, operation: string): string {
  const trimmed = expenseId.trim();

  if (!trimmed) {
    throw new DataAccessError({
      operation,
      message: "expenseId is required and must be a non-empty string",
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
): value is ExpenseJournalLinkage["status"] {
  return value === "posted" || value === "draft" || value === "reversed";
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

export async function getExpenseJournalLinkage(
  organizationId: string,
  expenseId: string,
): Promise<ExpenseJournalLinkage | null> {
  const operation = "getExpenseJournalLinkage";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedExpenseId = requireExpenseId(expenseId, operation);
  const supabase = await createServerSupabaseClient();

  const expenseResult = await supabase
    .from("expenses")
    .select("id, organization_id, status, journal_entry_id, reference")
    .eq("id", scopedExpenseId)
    .eq("organization_id", scopedOrganizationId);

  const expenses = unwrapRows<ExpenseJournalLinkageExpenseRow>(
    `${operation}.expense`,
    expenseResult,
  );

  if (expenses.length === 0) {
    return null;
  }

  const expense = expenses[0];

  if (expense.status !== "recorded" || expense.journal_entry_id == null) {
    return null;
  }

  const journalEntryId = expense.journal_entry_id;

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
    sourceReference: expense.reference,
  };
}
