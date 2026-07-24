import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError } from "./query-helpers";
import type { JournalEntryRow } from "./types/rows";

export type CreateManualJournalLineInput = {
  accountId: string;
  description: string | null;
  debit: number;
  credit: number;
  fundId: string | null;
};

export type CreateManualJournalInput = {
  entryDate: string;
  description: string;
  periodId: string;
  lines: CreateManualJournalLineInput[];
};

export type CreateManualJournalResult = {
  journalEntryId: string;
  entryNumber: string;
};

function mapJournalEntryRow(row: JournalEntryRow): CreateManualJournalResult {
  return {
    journalEntryId: row.id,
    entryNumber: row.entry_number,
  };
}

function normalizeRpcLines(lines: CreateManualJournalLineInput[]) {
  return lines.map((line) => ({
    account_id: line.accountId,
    description: line.description,
    debit: line.debit,
    credit: line.credit,
    fund_id: line.fundId,
  }));
}

export async function createManualJournal(
  organizationId: string,
  input: CreateManualJournalInput,
): Promise<CreateManualJournalResult> {
  const operation = "createManualJournal";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("record_manual_journal", {
    target_organization_id: scopedOrganizationId,
    input_entry_date: input.entryDate,
    input_description: input.description,
    input_period_id: input.periodId,
    input_lines: normalizeRpcLines(input.lines),
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[createManualJournal RPC diagnostic]", {
        operation,
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        organizationId: scopedOrganizationId,
      });
    }

    throw toDataAccessError(operation, result.error);
  }

  if (!result.data) {
    throw new DataAccessError({
      operation,
      message: "Manual journal recording returned no row",
    });
  }

  return mapJournalEntryRow(result.data as JournalEntryRow);
}
