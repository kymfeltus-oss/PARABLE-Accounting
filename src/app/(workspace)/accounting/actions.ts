"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  closeAccountingPeriod,
  createAccount,
  createAccountingPeriod,
  type AccountingPeriodRecord,
  updateAccount,
} from "@/lib/data/accounting-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { AccountRow } from "@/lib/data/types/rows";
import {
  createManualJournal,
  type CreateManualJournalLineInput,
} from "@/lib/data/manual-journal-repository";
import { reverseJournalEntry } from "@/lib/data/journal-reversal-repository";
import { voidJournalEntry } from "@/lib/data/journal-void-repository";

const GENERIC_CREATE_ACCOUNT_ERROR =
  "Unable to create account. Please verify the information and your access, then try again.";

const GENERIC_UPDATE_ACCOUNT_ERROR =
  "Unable to update account. Please verify the information and your access, then try again.";

const GENERIC_CREATE_ACCOUNTING_PERIOD_ERROR =
  "Unable to create accounting period. Please verify the information and your access, then try again.";

const GENERIC_CLOSE_ACCOUNTING_PERIOD_ERROR =
  "Unable to close accounting period. Please verify the information and your access, then try again.";

export type CreateAccountActionResult =
  | { ok: true; account: AccountRow }
  | { ok: false; error: string };

export type UpdateAccountActionResult =
  | { ok: true; account: AccountRow }
  | { ok: false; error: string };

export type CreateAccountingPeriodActionResult =
  | { ok: true; period: AccountingPeriodRecord }
  | { ok: false; error: string };

export type CloseAccountingPeriodActionResult =
  | { ok: true; period: AccountingPeriodRecord }
  | { ok: false; error: string };

function readFormString(formData: FormData, field: string): string {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return value;
}

function readOptionalFormString(
  formData: FormData,
  field: string,
): string | null {
  const trimmed = readFormString(formData, field).trim();

  return trimmed === "" ? null : trimmed;
}

function readFormBoolean(formData: FormData, field: string): boolean {
  const value = formData.get(field);

  if (value === "on" || value === "true" || value === "1") {
    return true;
  }

  return false;
}

export async function createAccountAction(
  formData: FormData,
): Promise<CreateAccountActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create accounts.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const account = await createAccount(organizationId, {
      code: readFormString(formData, "code"),
      name: readFormString(formData, "name"),
      accountType: readFormString(formData, "accountType"),
      isPosting: readFormBoolean(formData, "isPosting"),
    });

    revalidatePath("/accounting");

    return { ok: true, account };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "code is required") {
        return {
          ok: false,
          error: "Account code is required.",
        };
      }

      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Account name is required.",
        };
      }

      if (error.message === "accountType is required") {
        return {
          ok: false,
          error: "Account type is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_ACCOUNT_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating an account. Please try again.",
    };
  }
}

export async function updateAccountAction(
  formData: FormData,
): Promise<UpdateAccountActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to update accounts.",
    };
  }

  const accountId = readFormString(formData, "accountId").trim();

  if (accountId === "") {
    return {
      ok: false,
      error: GENERIC_UPDATE_ACCOUNT_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const account = await updateAccount(organizationId, {
      accountId,
      code: readFormString(formData, "code"),
      name: readFormString(formData, "name"),
      accountType: readFormString(formData, "accountType"),
      isPosting: readFormBoolean(formData, "isPosting"),
      status: readOptionalFormString(formData, "status"),
    });

    revalidatePath("/accounting");

    return { ok: true, account };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "code is required") {
        return {
          ok: false,
          error: "Account code is required.",
        };
      }

      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Account name is required.",
        };
      }

      if (error.message === "accountType is required") {
        return {
          ok: false,
          error: "Account type is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_UPDATE_ACCOUNT_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while updating an account. Please try again.",
    };
  }
}

export async function createAccountingPeriodAction(
  formData: FormData,
): Promise<CreateAccountingPeriodActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create accounting periods.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const period = await createAccountingPeriod(organizationId, {
      name: readFormString(formData, "name"),
      startDate: readFormString(formData, "startDate"),
      endDate: readFormString(formData, "endDate"),
    });

    revalidatePath("/accounting");

    return { ok: true, period };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Accounting period name is required.",
        };
      }

      if (error.message === "startDate is required") {
        return {
          ok: false,
          error: "Accounting period start date is required.",
        };
      }

      if (error.message === "endDate is required") {
        return {
          ok: false,
          error: "Accounting period end date is required.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_ACCOUNTING_PERIOD_ERROR,
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while creating an accounting period. Please try again.",
    };
  }
}

export async function closeAccountingPeriodAction(
  formData: FormData,
): Promise<CloseAccountingPeriodActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to close accounting periods.",
    };
  }

  const periodId = readFormString(formData, "periodId").trim();

  if (periodId === "") {
    return {
      ok: false,
      error: GENERIC_CLOSE_ACCOUNTING_PERIOD_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const period = await closeAccountingPeriod(organizationId, periodId);

    revalidatePath("/accounting");

    return { ok: true, period };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error: GENERIC_CLOSE_ACCOUNTING_PERIOD_ERROR,
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while closing an accounting period. Please try again.",
    };
  }
}

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

const GENERIC_VOID_JOURNAL_ERROR =
  "The journal entry could not be voided. Please try again.";

const VOID_JOURNAL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
  "Insufficient role to void journal entry":
    "You do not have permission to void journal entries.",
  "Journal entry not found": "The journal entry was not found.",
  "Journal entry does not belong to organization":
    "The journal entry was not found.",
  "Only posted journal entries can be voided":
    "Only posted journal entries can be voided.",
  "Journal entry has already been voided":
    "This journal entry has already been voided.",
  "Journal entry has already been reversed":
    "This journal entry has already been reversed.",
  "Reversal journal cannot be voided":
    "Reversal journals cannot be voided.",
  "Journal source type cannot be voided":
    "This journal source type cannot be voided.",
  "Void reason is required": "A void reason is required.",
  "Void reason must be 500 characters or fewer":
    "The void reason must be 500 characters or fewer.",
};

const ALLOWED_VOID_JOURNAL_KEYS = new Set(["journalEntryId", "reason"]);

export type VoidJournalEntryActionInput = {
  journalEntryId: string;
  reason: string;
};

export type VoidJournalEntryActionResult =
  | {
      success: true;
      journalEntryId: string;
      entryNumber: string;
    }
  | {
      success: false;
      message: string;
    };

type ValidatedVoidJournalEntryInput = {
  journalEntryId: string;
  reason: string;
};

function mapVoidJournalError(error: DataAccessError): string {
  return (
    VOID_JOURNAL_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_VOID_JOURNAL_ERROR
  );
}

function validateVoidJournalEntryInput(
  input: VoidJournalEntryActionInput,
): VoidJournalEntryActionResult | ValidatedVoidJournalEntryInput {
  const unknownKeys = Object.keys(input).filter(
    (key) => !ALLOWED_VOID_JOURNAL_KEYS.has(key),
  );

  if (unknownKeys.length > 0) {
    return {
      success: false,
      message: GENERIC_VOID_JOURNAL_ERROR,
    };
  }

  const journalEntryId = input.journalEntryId.trim();

  if (journalEntryId === "" || !isValidUuid(journalEntryId)) {
    return {
      success: false,
      message: GENERIC_VOID_JOURNAL_ERROR,
    };
  }

  const reason = input.reason.trim();

  if (reason === "") {
    return {
      success: false,
      message: "A void reason is required.",
    };
  }

  if (reason.length > 500) {
    return {
      success: false,
      message: "The void reason must be 500 characters or fewer.",
    };
  }

  return {
    journalEntryId,
    reason,
  };
}

export async function voidJournalEntryAction(
  input: VoidJournalEntryActionInput,
): Promise<VoidJournalEntryActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to void journal entries.",
    };
  }

  const validationResult = validateVoidJournalEntryInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedVoidJournalEntryInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const result = await voidJournalEntry(organizationId, validatedInput);

    revalidatePath("/accounting/journals");
    revalidatePath(`/accounting/journals/${validatedInput.journalEntryId}`);
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      journalEntryId: result.journalEntryId,
      entryNumber: result.entryNumber,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapVoidJournalError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_VOID_JOURNAL_ERROR,
    };
  }
}
