"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import { recordGiving } from "@/lib/data/giving-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_RECORD_GIVING_ERROR =
  "The giving transaction could not be recorded. Please try again.";

const RECORD_GIVING_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Giving transaction is not in recorded status":
    "This giving transaction is not eligible for ledger recording.",
  "Giving transaction is already linked to a journal entry":
    "This giving transaction has already been recorded to the ledger.",
  "Giving transaction already has a recorded journal entry":
    "This giving transaction has already been recorded to the ledger.",
  "Insufficient role to record giving":
    "You do not have permission to record this giving transaction.",
  "Accounting period is closed":
    "This giving transaction cannot be recorded because its accounting period is closed.",
  "Accounting period is locked":
    "This giving transaction cannot be recorded because its accounting period is locked.",
  "Debit account does not belong to organization":
    "The selected debit account is not available for this organization.",
  "Credit account does not belong to organization":
    "The selected revenue account is not available for this organization.",
  "Debit account must be an asset account for cash giving method":
    "The selected debit account cannot be used for this cash giving transaction.",
  "Debit account must be an asset account for check giving method":
    "The selected debit account cannot be used for this check giving transaction.",
  "Debit account must be an asset account for ach giving method":
    "The selected debit account cannot be used for this ACH giving transaction.",
  "Debit account must be an asset or liability account for card giving method":
    "The selected debit account cannot be used for this card giving transaction.",
  "Debit account must be an asset or liability account for other giving method":
    "The selected debit account cannot be used for this giving transaction.",
  "Credit account must be a revenue account":
    "The selected credit account must be a revenue account.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_RECORD_GIVING_KEYS = new Set([
  "givingTransactionId",
  "debitAccountId",
  "creditAccountId",
]);

export type RecordGivingActionInput = {
  givingTransactionId: string;
  debitAccountId: string;
  creditAccountId: string;
};

export type RecordGivingActionResult =
  | {
      success: true;
      givingTransactionId: string;
      status: "recorded";
      journalEntryId: string | null;
    }
  | {
      success: false;
      fieldErrors?: {
        givingTransactionId?: string;
        debitAccountId?: string;
        creditAccountId?: string;
      };
      message: string;
    };

type ValidatedRecordGivingInput = {
  givingTransactionId: string;
  debitAccountId: string;
  creditAccountId: string;
};

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function mapRecordGivingError(error: DataAccessError): string {
  return (
    RECORD_GIVING_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_RECORD_GIVING_ERROR
  );
}

function validateRecordGivingInput(
  input: RecordGivingActionInput,
): RecordGivingActionResult | ValidatedRecordGivingInput {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      message: GENERIC_RECORD_GIVING_ERROR,
    };
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_RECORD_GIVING_KEYS.has(key)) {
      return {
        success: false,
        message: GENERIC_RECORD_GIVING_ERROR,
      };
    }
  }

  const givingTransactionId = input.givingTransactionId.trim();
  const debitAccountId = input.debitAccountId.trim();
  const creditAccountId = input.creditAccountId.trim();
  const fieldErrors: NonNullable<
    Extract<RecordGivingActionResult, { success: false }>["fieldErrors"]
  > = {};

  if (givingTransactionId === "" || !isValidUuid(givingTransactionId)) {
    fieldErrors.givingTransactionId =
      "Enter a valid giving transaction identifier.";
  }

  if (debitAccountId === "" || !isValidUuid(debitAccountId)) {
    fieldErrors.debitAccountId = "Enter a valid debit account.";
  }

  if (creditAccountId === "" || !isValidUuid(creditAccountId)) {
    fieldErrors.creditAccountId = "Enter a valid revenue account.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
      message: GENERIC_RECORD_GIVING_ERROR,
    };
  }

  return {
    givingTransactionId,
    debitAccountId,
    creditAccountId,
  };
}

export async function recordGivingAction(
  input: RecordGivingActionInput,
): Promise<RecordGivingActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to record giving transactions.",
    };
  }

  const validationResult = validateRecordGivingInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedRecordGivingInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const givingTransaction = await recordGiving(
      organizationId,
      validatedInput.givingTransactionId,
      validatedInput.debitAccountId,
      validatedInput.creditAccountId,
    );

    revalidatePath("/giving");
    revalidatePath(`/giving/${validatedInput.givingTransactionId}`);

    return {
      success: true,
      givingTransactionId: givingTransaction.id,
      status: "recorded",
      journalEntryId: givingTransaction.journal_entry_id ?? null,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapRecordGivingError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_RECORD_GIVING_ERROR,
    };
  }
}
