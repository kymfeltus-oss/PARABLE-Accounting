import { createServerSupabaseClient } from "@/lib/supabase/server";

import { DataAccessError } from "./data-access-error";
import { requireOrganizationId } from "./organization-id";
import { toDataAccessError, unwrapRows } from "./query-helpers";
import type { JournalEntryRow } from "./types/rows";

export type VoidJournalEntryInput = {
  journalEntryId: string;
  reason: string;
};

export type VoidJournalEntryResult = {
  journalEntryId: string;
  entryNumber: string;
};

export type JournalVoidEligibility = {
  canVoid: boolean;
  reason: string | null;
};

const VOIDABLE_SOURCE_TYPES = new Set(["manual", "adjustment"]);
const VOID_ROLES = new Set(["owner", "accountant", "staff"]);

function mapJournalEntryRow(row: JournalEntryRow): VoidJournalEntryResult {
  return {
    journalEntryId: row.id,
    entryNumber: row.entry_number,
  };
}

export async function getJournalVoidEligibility(
  organizationId: string,
  journalEntryId: string,
): Promise<JournalVoidEligibility> {
  const operation = "getJournalVoidEligibility";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const scopedJournalEntryId = journalEntryId.trim();

  if (!scopedJournalEntryId) {
    throw new DataAccessError({
      operation,
      message: "journalEntryId is required and must be a non-empty string",
    });
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      canVoid: false,
      reason: "You must be signed in to void journal entries.",
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

  if (!membershipRole || !VOID_ROLES.has(membershipRole)) {
    return {
      canVoid: false,
      reason: "You do not have permission to void journal entries.",
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
      canVoid: false,
      reason: "Journal entry was not found.",
    };
  }

  const journal = journals[0];

  if (
    journal.source_type === "reversal" ||
    journal.reverses_journal_entry_id != null
  ) {
    return {
      canVoid: false,
      reason: "Reversal journals cannot be voided.",
    };
  }

  if (journal.status === "void") {
    return {
      canVoid: false,
      reason: "This journal entry has already been voided.",
    };
  }

  if (journal.status === "reversed") {
    return {
      canVoid: false,
      reason: "This journal entry has already been reversed.",
    };
  }

  if (journal.status !== "posted") {
    return {
      canVoid: false,
      reason: "Only posted journal entries can be voided.",
    };
  }

  if (!VOIDABLE_SOURCE_TYPES.has(journal.source_type)) {
    return {
      canVoid: false,
      reason: "This journal source type cannot be voided.",
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
      canVoid: false,
      reason: "This journal entry has already been reversed.",
    };
  }

  return {
    canVoid: true,
    reason: null,
  };
}

export async function voidJournalEntry(
  organizationId: string,
  input: VoidJournalEntryInput,
): Promise<VoidJournalEntryResult> {
  const operation = "voidJournalEntry";
  const scopedOrganizationId = requireOrganizationId(organizationId, operation);
  const supabase = await createServerSupabaseClient();

  const result = await supabase.rpc("void_journal_entry", {
    target_organization_id: scopedOrganizationId,
    target_journal_entry_id: input.journalEntryId,
    input_reason: input.reason,
  });

  if (result.error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[voidJournalEntry RPC diagnostic]", {
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
      message: "Journal void returned no row",
    });
  }

  return mapJournalEntryRow(result.data as JournalEntryRow);
}
