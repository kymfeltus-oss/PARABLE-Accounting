"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createGivingTransaction,
  recordGiving,
  type GivingMethod,
} from "@/lib/data/giving-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_RECORD_GIVING_ERROR =
  "The giving transaction could not be recorded. Please try again.";

const GENERIC_CREATE_GIVING_ERROR =
  "Unable to create giving transaction. Please verify the information and try again.";

const CREATE_GIVING_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Insufficient role to create giving transaction":
    "You do not have permission to create giving transactions.",
  "Amount must be greater than zero":
    "Enter an amount greater than zero.",
  "Invalid giving method":
    "Select a valid giving method.",
  "Member does not belong to organization":
    "The selected member is not available for this organization.",
  "Fund does not belong to organization":
    "The selected fund is not available for this organization.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const GIVING_METHODS: readonly GivingMethod[] = [
  "cash",
  "check",
  "card",
  "ach",
  "other",
];

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

export type CreateGivingTransactionActionInput = {
  transactionDate: string;
  amount: number;
  givingMethod: GivingMethod;
  memberId?: string | null;
  fundId?: string | null;
  reference?: string | null;
  debitAccountId?: string | null;
  creditAccountId?: string | null;
};

export type CreateGivingTransactionActionResult =
  | {
      success: true;
      givingTransactionId: string;
      journalEntryId: string | null;
      ledgerError?: string;
    }
  | {
      success: false;
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
  if (
    error.message.includes("Could not find the function public.record_giving")
  ) {
    return "Ledger recording is not available right now. The giving transaction may have been saved — try recording it from the giving detail page, or contact support.";
  }

  return (
    RECORD_GIVING_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_RECORD_GIVING_ERROR
  );
}

function mapCreateGivingError(error: DataAccessError): string {
  return (
    CREATE_GIVING_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_CREATE_GIVING_ERROR
  );
}

function isValidGivingMethod(value: string): value is GivingMethod {
  return GIVING_METHODS.includes(value as GivingMethod);
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

function validateCreateGivingInput(
  input: CreateGivingTransactionActionInput,
): CreateGivingTransactionActionResult | CreateGivingTransactionActionInput {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  const transactionDate = input.transactionDate.trim();
  const givingMethod = input.givingMethod;

  if (transactionDate === "") {
    return { success: false, message: "Transaction date is required." };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  if (!isValidGivingMethod(givingMethod)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  const debitAccountId = input.debitAccountId?.trim() ?? "";
  const creditAccountId = input.creditAccountId?.trim() ?? "";

  if (debitAccountId !== "" && !isValidUuid(debitAccountId)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  if (creditAccountId !== "" && !isValidUuid(creditAccountId)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  if (
    (debitAccountId !== "" && creditAccountId === "") ||
    (debitAccountId === "" && creditAccountId !== "")
  ) {
    return {
      success: false,
      message: "Select both debit and revenue accounts to record immediately.",
    };
  }

  const memberId = input.memberId?.trim() ?? "";
  if (memberId !== "" && !isValidUuid(memberId)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  const fundId = input.fundId?.trim() ?? "";
  if (fundId !== "" && !isValidUuid(fundId)) {
    return { success: false, message: GENERIC_CREATE_GIVING_ERROR };
  }

  return {
    transactionDate,
    amount: input.amount,
    givingMethod,
    memberId: memberId === "" ? null : memberId,
    fundId: fundId === "" ? null : fundId,
    reference:
      input.reference === undefined || input.reference === null
        ? null
        : input.reference.trim() === ""
          ? null
          : input.reference.trim(),
    debitAccountId: debitAccountId === "" ? null : debitAccountId,
    creditAccountId: creditAccountId === "" ? null : creditAccountId,
  };
}

export async function createGivingTransactionAction(
  input: CreateGivingTransactionActionInput,
): Promise<CreateGivingTransactionActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to create giving transactions.",
    };
  }

  const validationResult = validateCreateGivingInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult;

  try {
    const organizationId = await getCurrentOrganizationId();
    const givingTransaction = await createGivingTransaction(organizationId, {
      transactionDate: validatedInput.transactionDate,
      amount: validatedInput.amount,
      givingMethod: validatedInput.givingMethod,
      memberId: validatedInput.memberId,
      fundId: validatedInput.fundId,
      reference: validatedInput.reference,
    });

    let journalEntryId: string | null = null;

    let ledgerError: string | undefined;

    if (validatedInput.debitAccountId && validatedInput.creditAccountId) {
      try {
        const recorded = await recordGiving(
          organizationId,
          givingTransaction.id,
          validatedInput.debitAccountId,
          validatedInput.creditAccountId,
        );
        journalEntryId = recorded.journal_entry_id ?? null;
      } catch (error) {
        ledgerError =
          error instanceof DataAccessError
            ? mapRecordGivingError(error)
            : GENERIC_RECORD_GIVING_ERROR;
      }
    }

    revalidatePath("/giving");
    revalidatePath(`/giving/${givingTransaction.id}`);

    return {
      success: true,
      givingTransactionId: givingTransaction.id,
      journalEntryId,
      ...(ledgerError ? { ledgerError } : {}),
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapCreateGivingError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_CREATE_GIVING_ERROR,
    };
  }
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
