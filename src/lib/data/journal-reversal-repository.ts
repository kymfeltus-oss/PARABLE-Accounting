import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type { AccountingPeriodRow, JournalEntryRow } from "./types/rows";

export type ReverseJournalEntryInput = {
  journalEntryId: string;
  reversalDate: string;
  periodId: string;
  reason: string;
};

export type ReverseJournalEntryResult = {
  journalEntryId: string;
  entryNumber: string;
};

export type JournalReversalPeriodOption = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

export type JournalReversalEligibility = {
  canReverse: boolean;
  reason: string | null;
  periods: JournalReversalPeriodOption[];
};

const REVERSIBLE_SOURCE_TYPES = new Set(["manual", "adjustment"]);
const REVERSAL_ROLES = new Set(["owner", "accountant", "staff"]);

function mapJournalEntryRow(row: JournalEntryRow): ReverseJournalEntryResult {
  return {
    journalEntryId: row.id,
    entryNumber: row.entry_number,
  };
}

function sortPeriods(
  periods: JournalReversalPeriodOption[],
): JournalReversalPeriodOption[] {
  return [...periods].sort((left, right) => {
    const startCompare = left.startDate.localeCompare(right.startDate);

    if (startCompare !== 0) {
      return startCompare;
    }

    return left.name.localeCompare(right.name);
  });
}

async function loadOpenPeriods(
  organizationId: string,
): Promise<JournalReversalPeriodOption[]> {
  const operation = "getJournalReversalEligibility.periods";
  const supabase = await createServerSupabaseClient();

  const periodsResult = await supabase
    .from("accounting_periods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .order("start_date", { ascending: true })
    .order("name", { ascending: true });

  const periods = unwrapRows<AccountingPeriodRow>(operation, periodsResult);

  return sortPeriods(
    periods
      .filter((period) => period.organization_id === organizationId)
      .map((period) => ({
        id: period.id,
        name: period.name,
        startDate: period.start_date,
        endDate: period.end_date,
        isOpen: period.status === "open",
      })),
  );
}

export async function getJournalReversalEligibility(
  organizationId: string,
  journalEntryId: string,
): Promise<JournalReversalEligibility> {
  const operation = "getJournalReversalEligibility";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedJournalEntryId = journalEntryId.trim();

  if (!scopedJournalEntryId) {
    throw new DataAccessError({
      operation,
      message: "journalEntryId is required and must be a non-empty string",
    });
  }

  const supabase = await createServerSupabaseClient();
  const periods = await loadOpenPeriods(scopedOrganizationId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      canReverse: false,
      reason: "You must be signed in to reverse journal entries.",
      periods,
    };
  }

  const membershipResult = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", scopedOrganizationId)
    .eq("user_id", user.id);

  if (membershipResult.error) {
    throw toDataAccessError(`${operation}.membership`, membershipResult.error);
  }

  const membershipRole = (
    (membershipResult.data ?? []) as Array<{ role: string }>
  )[0]?.role;

  if (!membershipRole || !REVERSAL_ROLES.has(membershipRole)) {
    return {
      canReverse: false,
      reason: "You do not have permission to reverse journal entries.",
      periods,
    };
  }

  const journalResult = await supabase
    .from("journal_entries")
    .select(
      "id, organization_id, source_type, status, reverses_journal_entry_id",
    )
    .eq("id", scopedJournalEntryId)
    .eq("organization_id", scopedOrganizationId);

  const journals = unwrapRows<{
    id: string;
    organization_id: string;
    source_type: string;
    status: string;
    reverses_journal_entry_id: string | null;
  }>(`${operation}.journal`, journalResult).filter(
    (journal) => journal.organization_id === scopedOrganizationId,
  );

  if (journals.length === 0) {
    return {
      canReverse: false,
      reason: "Journal entry was not found.",
      periods,
    };
  }

  const journal = journals[0];

  if (
    journal.source_type === "reversal" ||
    journal.reverses_journal_entry_id != null
  ) {
    return {
      canReverse: false,
      reason: "Reversal journals cannot be reversed.",
      periods,
    };
  }

  if (journal.status === "reversed") {
    return {
      canReverse: false,
      reason: "This journal entry has already been reversed.",
      periods,
    };
  }

  if (journal.status === "void") {
    return {
      canReverse: false,
      reason: "This journal entry has already been voided.",
      periods,
    };
  }

  if (journal.status !== "posted") {
    return {
      canReverse: false,
      reason: "Only posted journal entries can be reversed.",
      periods,
    };
  }

  if (!REVERSIBLE_SOURCE_TYPES.has(journal.source_type)) {
    return {
      canReverse: false,
      reason: "This journal source type cannot be reversed.",
      periods,
    };
  }

  const existingReversalResult = await supabase
    .from("journal_entries")
    .select("id")
    .eq("organization_id", scopedOrganizationId)
    .eq("reverses_journal_entry_id", journal.id);

  const existingReversals = unwrapRows<{ id: string }>(
    `${operation}.existingReversal`,
    existingReversalResult,
  );

  if (existingReversals.length > 0) {
    return {
      canReverse: false,
      reason: "This journal entry has already been reversed.",
      periods,
    };
  }

  if (periods.length === 0) {
    return {
      canReverse: false,
      reason: "No open accounting periods are available for reversal.",
      periods,
    };
  }

  return {
    canReverse: true,
    reason: null,
    periods,
  };
}

export async function reverseJournalEntry(
  organizationId: string,
  input: ReverseJournalEntryInput,
): Promise<ReverseJournalEntryResult> {
  const operation = "reverseJournalEntry";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("reverse_journal_entry", {
    target_organization_id: scopedOrganizationId,
    target_journal_entry_id: input.journalEntryId,
    input_reversal_date: input.reversalDate,
    input_period_id: input.periodId,
    input_reason: input.reason,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[reverseJournalEntry RPC diagnostic]", {
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
      message: "Journal reversal returned no row",
    });
  }

  return mapJournalEntryRow(result.data as JournalEntryRow);
}
