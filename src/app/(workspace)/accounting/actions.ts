"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createManualJournal,
  type CreateManualJournalLineInput,
} from "@/lib/data/manual-journal-repository";
import { reverseJournalEntry } from "@/lib/data/journal-reversal-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_CREATE_MANUAL_JOURNAL_ERROR =
  "The manual journal entry could not be recorded. Please try again.";

const CREATE_MANUAL_JOURNAL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> =
  {
    "Authenticated user is required":
      "Your session has expired. Please sign in again.",
    "Insufficient role to record manual journal":
      "You do not have permission to record manual journal entries.",
    "Accounting period is closed":
      "The selected accounting period is closed.",
    "Accounting period is locked":
      "The selected accounting period is locked.",
    "Accounting period is not open":
      "The selected accounting period is not open.",
    "Accounting period does not belong to organization":
      "The selected accounting period is not available for this organization.",
    "Accounting period not found":
      "The selected accounting period is not available.",
    "Entry date is outside the selected accounting period":
      "The entry date must fall within the selected accounting period.",
    "Description is required":
      "A description is required for the journal entry.",
    "At least two journal lines are required":
      "At least two journal lines are required.",
    "Account does not belong to organization":
      "One or more selected accounts are not available for this organization.",
    "Account must be active and posting-enabled":
      "One or more selected accounts are inactive or not posting-enabled.",
    "Fund does not belong to organization":
      "One or more selected funds are not available for this organization.",
    "Fund must be active":
      "One or more selected funds are inactive.",
    "Each line must have either a debit or a credit":
      "Each line must have either a debit or a credit amount.",
    "Each line cannot have both debit and credit":
      "Each line cannot have both a debit and a credit amount.",
    "Line amounts must be nonnegative":
      "Debit and credit amounts must be zero or greater.",
    "Each line must have a positive debit or credit amount":
      "Each line must include a positive debit or credit amount.",
    "Journal entry is not balanced":
      "Total debits must equal total credits.",
    "Journal entry total must be greater than zero":
      "The journal entry total must be greater than zero.",
  };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_CREATE_MANUAL_JOURNAL_KEYS = new Set([
  "entryDate",
  "description",
  "periodId",
  "lines",
]);

const ALLOWED_CREATE_MANUAL_JOURNAL_LINE_KEYS = new Set([
  "accountId",
  "description",
  "debit",
  "credit",
  "fundId",
]);

export type CreateManualJournalActionInput = {
  entryDate: string;
  description: string;
  periodId: string;
  lines: Array<{
    accountId: string;
    description?: string | null;
    debit: number;
    credit: number;
    fundId?: string | null;
  }>;
};

export type CreateManualJournalActionResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
    };

type ValidatedCreateManualJournalLineInput = CreateManualJournalLineInput;

type ValidatedCreateManualJournalInput = {
  entryDate: string;
  description: string;
  periodId: string;
  lines: ValidatedCreateManualJournalLineInput[];
};

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function parseAmount(value: number | string): number | null {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function hasAtMostTwoDecimalPlaces(amount: number): boolean {
  return Math.round(amount * 100) === amount * 100;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function mapCreateManualJournalError(error: DataAccessError): string {
  return (
    CREATE_MANUAL_JOURNAL_RPC_ERROR_MESSAGES[error.message] ??
    GENERIC_CREATE_MANUAL_JOURNAL_ERROR
  );
}

function validateCreateManualJournalInput(
  input: CreateManualJournalActionInput,
): CreateManualJournalActionResult | ValidatedCreateManualJournalInput {
  const unknownKeys = Object.keys(input).filter(
    (key) => !ALLOWED_CREATE_MANUAL_JOURNAL_KEYS.has(key),
  );

  if (unknownKeys.length > 0) {
    return {
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    };
  }

  const entryDate = input.entryDate.trim();

  if (!isValidIsoDate(entryDate)) {
    return {
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    };
  }

  const description = input.description.trim();

  if (description === "") {
    return {
      success: false,
      message: "A description is required for the journal entry.",
    };
  }

  const periodId = input.periodId.trim();

  if (periodId === "" || !isValidUuid(periodId)) {
    return {
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    };
  }

  if (!Array.isArray(input.lines)) {
    return {
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    };
  }

  if (input.lines.length < 2) {
    return {
      success: false,
      message: "At least two journal lines are required.",
    };
  }

  const validatedLines: ValidatedCreateManualJournalLineInput[] = [];
  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of input.lines) {
    const unknownLineKeys = Object.keys(line).filter(
      (key) => !ALLOWED_CREATE_MANUAL_JOURNAL_LINE_KEYS.has(key),
    );

    if (unknownLineKeys.length > 0) {
      return {
        success: false,
        message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
      };
    }

    const accountId = line.accountId.trim();

    if (accountId === "" || !isValidUuid(accountId)) {
      return {
        success: false,
        message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
      };
    }

    const fundId = normalizeOptionalString(line.fundId ?? null);

    if (fundId != null && !isValidUuid(fundId)) {
      return {
        success: false,
        message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
      };
    }

    const debit = parseAmount(line.debit);
    const credit = parseAmount(line.credit);

    if (debit == null || credit == null) {
      return {
        success: false,
        message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
      };
    }

    if (debit < 0 || credit < 0) {
      return {
        success: false,
        message: "Debit and credit amounts must be zero or greater.",
      };
    }

    if (!hasAtMostTwoDecimalPlaces(debit) || !hasAtMostTwoDecimalPlaces(credit)) {
      return {
        success: false,
        message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
      };
    }

    if (debit > 0 && credit > 0) {
      return {
        success: false,
        message: "Each line cannot have both a debit and a credit amount.",
      };
    }

    if (debit === 0 && credit === 0) {
      return {
        success: false,
        message: "Each line must include a positive debit or credit amount.",
      };
    }

    totalDebits += debit;
    totalCredits += credit;

    validatedLines.push({
      accountId,
      description: normalizeOptionalString(line.description ?? null),
      debit,
      credit,
      fundId,
    });
  }

  if (totalDebits !== totalCredits) {
    return {
      success: false,
      message: "Total debits must equal total credits.",
    };
  }

  if (totalDebits <= 0) {
    return {
      success: false,
      message: "The journal entry total must be greater than zero.",
    };
  }

  return {
    entryDate,
    description,
    periodId,
    lines: validatedLines,
  };
}

export async function createManualJournalAction(
  input: CreateManualJournalActionInput,
): Promise<CreateManualJournalActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to record manual journal entries.",
    };
  }

  const validationResult = validateCreateManualJournalInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedCreateManualJournalInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const result = await createManualJournal(organizationId, validatedInput);

    revalidatePath("/accounting/journals");
    revalidatePath(`/accounting/journals/${result.journalEntryId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      journalEntryId: result.journalEntryId,
      entryNumber: result.entryNumber,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapCreateManualJournalError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_CREATE_MANUAL_JOURNAL_ERROR,
    };
  }
}

const GENERIC_REVERSE_JOURNAL_ERROR =
  "The journal entry could not be reversed. Please try again.";

const REVERSE_JOURNAL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
  "Insufficient role to reverse journal entry":
    "You do not have permission to reverse journal entries.",
  "Journal entry not found": "The journal entry was not found.",
  "Journal entry does not belong to organization":
    "The journal entry was not found.",
  "Only posted journal entries can be reversed":
    "Only posted journal entries can be reversed.",
  "Journal entry has already been reversed":
    "This journal entry has already been reversed.",
  "Reversal journal cannot be reversed":
    "Reversal journals cannot be reversed.",
  "Journal source type cannot be reversed":
    "This journal source type cannot be reversed.",
  "Accounting period is closed": "The selected accounting period is closed.",
  "Accounting period is locked": "The selected accounting period is locked.",
  "Accounting period is not open":
    "The selected accounting period is not open.",
  "Accounting period does not belong to organization":
    "The selected accounting period is not available for this organization.",
  "Accounting period not found":
    "The selected accounting period is not available.",
  "Reversal date is outside the selected accounting period":
    "The reversal date must fall within the selected accounting period.",
  "Reversal reason is required": "A reversal reason is required.",
  "Reversal reason must be 500 characters or fewer":
    "The reversal reason must be 500 characters or fewer.",
  "Journal entry must have at least two lines to reverse":
    "The journal entry must have at least two lines to reverse.",
  "Journal entry is not balanced":
    "The journal entry is not balanced and cannot be reversed.",
  "Journal entry total must be greater than zero":
    "The journal entry total must be greater than zero.",
  "Original account does not belong to organization":
    "One or more original accounts are not available for this organization.",
  "Original fund does not belong to organization":
    "One or more original funds are not available for this organization.",
};

const ALLOWED_REVERSE_JOURNAL_KEYS = new Set([
  "journalEntryId",
  "reversalDate",
  "periodId",
  "reason",
]);

export type ReverseJournalEntryActionInput = {
  journalEntryId: string;
  reversalDate: string;
  periodId: string;
  reason: string;
};

export type ReverseJournalEntryActionResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
    };

type ValidatedReverseJournalEntryInput = {
  journalEntryId: string;
  reversalDate: string;
  periodId: string;
  reason: string;
};

function mapReverseJournalError(error: DataAccessError): string {
  return (
    REVERSE_JOURNAL_RPC_ERROR_MESSAGES[error.message] ??
    GENERIC_REVERSE_JOURNAL_ERROR
  );
}

function validateReverseJournalEntryInput(
  input: ReverseJournalEntryActionInput,
): ReverseJournalEntryActionResult | ValidatedReverseJournalEntryInput {
  const unknownKeys = Object.keys(input).filter(
    (key) => !ALLOWED_REVERSE_JOURNAL_KEYS.has(key),
  );

  if (unknownKeys.length > 0) {
    return {
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    };
  }

  const journalEntryId = input.journalEntryId.trim();

  if (journalEntryId === "" || !isValidUuid(journalEntryId)) {
    return {
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    };
  }

  const reversalDate = input.reversalDate.trim();

  if (!isValidIsoDate(reversalDate)) {
    return {
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    };
  }

  const periodId = input.periodId.trim();

  if (periodId === "" || !isValidUuid(periodId)) {
    return {
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    };
  }

  const reason = input.reason.trim();

  if (reason === "") {
    return {
      success: false,
      message: "A reversal reason is required.",
    };
  }

  if (reason.length > 500) {
    return {
      success: false,
      message: "The reversal reason must be 500 characters or fewer.",
    };
  }

  return {
    journalEntryId,
    reversalDate,
    periodId,
    reason,
  };
}

export async function reverseJournalEntryAction(
  input: ReverseJournalEntryActionInput,
): Promise<ReverseJournalEntryActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to reverse journal entries.",
    };
  }

  const validationResult = validateReverseJournalEntryInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedReverseJournalEntryInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const result = await reverseJournalEntry(organizationId, validatedInput);

    revalidatePath("/accounting/journals");
    revalidatePath(`/accounting/journals/${validatedInput.journalEntryId}`);
    revalidatePath(`/accounting/journals/${result.journalEntryId}`);
    revalidatePath("/dashboard");

    return {
      success: true,
      journalEntryId: result.journalEntryId,
      entryNumber: result.entryNumber,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapReverseJournalError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_REVERSE_JOURNAL_ERROR,
    };
  }
}
