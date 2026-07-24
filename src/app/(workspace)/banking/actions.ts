"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createBankAccount,
  createBankTransaction,
  matchBankTransaction,
  type BankAccountRecord,
} from "@/lib/data/banking-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { BankTransactionRow } from "@/lib/data/types/rows";

const GENERIC_CREATE_BANK_ACCOUNT_ERROR =
  "Unable to create bank account. Please verify the information and try again.";

const GENERIC_CREATE_BANK_TRANSACTION_ERROR =
  "Unable to create bank transaction. Please verify the information and try again.";

const GENERIC_MATCH_BANK_TRANSACTION_ERROR =
  "Unable to match bank transaction. Please verify the information and try again.";

const CREATE_BANK_ACCOUNT_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Insufficient role to create bank account":
    "You do not have permission to create bank accounts.",
  "Chart account must be an asset account":
    "Select an active posting asset account from the chart.",
  "Chart account must be a posting account":
    "Select an active posting asset account from the chart.",
  "Chart account must be active":
    "Select an active posting asset account from the chart.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const CREATE_BANK_TRANSACTION_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Insufficient role to create bank transaction":
    "You do not have permission to create bank transactions.",
  "Amount must be nonzero": "Enter a nonzero amount.",
  "Bank account must be active":
    "The selected bank account is not available.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const MATCH_BANK_TRANSACTION_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Insufficient role to match bank transaction":
    "You do not have permission to match bank transactions.",
  "Bank transaction is already matched":
    "This bank transaction has already been matched.",
  "Bank transaction is excluded":
    "This bank transaction is excluded from matching.",
  "Match type is invalid": "Select a valid match type.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BANK_ACCOUNT_TYPES = ["checking", "savings", "money_market"] as const;
const BANK_TRANSACTION_TYPES = ["inbound", "outbound"] as const;
const MATCH_TYPES = [
  "bill_payment",
  "expense",
  "giving_transaction",
  "journal_entry",
] as const;

export type CreateBankAccountActionResult =
  | { ok: true; bankAccount: BankAccountRecord }
  | { ok: false; error: string };

export type CreateBankTransactionActionResult =
  | { ok: true; transaction: BankTransactionRow }
  | { ok: false; error: string };

export type MatchBankTransactionActionResult =
  | { ok: true; bankTransactionId: string; matchId: string }
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

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function mapRpcError(
  error: DataAccessError,
  messages: Readonly<Record<string, string>>,
  fallback: string,
): string {
  return messages[error.message] ?? fallback;
}

export async function createBankAccountAction(
  formData: FormData,
): Promise<CreateBankAccountActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create bank accounts.",
    };
  }

  const name = readFormString(formData, "name").trim();
  const accountId = readFormString(formData, "accountId").trim();
  const institutionName = readOptionalFormString(formData, "institutionName");
  const accountType = readOptionalFormString(formData, "accountType");
  const lastFour = readOptionalFormString(formData, "lastFour");

  if (name === "") {
    return { ok: false, error: "Bank account name is required." };
  }

  if (accountId === "" || !isValidUuid(accountId)) {
    return { ok: false, error: "Select a chart account." };
  }

  if (
    accountType !== null &&
    !BANK_ACCOUNT_TYPES.includes(
      accountType as (typeof BANK_ACCOUNT_TYPES)[number],
    )
  ) {
    return { ok: false, error: GENERIC_CREATE_BANK_ACCOUNT_ERROR };
  }

  if (lastFour !== null && !/^[0-9]{4}$/.test(lastFour)) {
    return { ok: false, error: "Last four digits must be exactly four numbers." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const bankAccount = await createBankAccount(organizationId, {
      name,
      accountId,
      institutionName,
      accountType,
      lastFour,
    });

    revalidatePath("/banking");
    revalidatePath("/transactions");

    return {
      ok: true,
      bankAccount: {
        ...bankAccount,
        ledgerBalance: 0,
      },
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error: mapRpcError(
          error,
          CREATE_BANK_ACCOUNT_RPC_ERROR_MESSAGES,
          GENERIC_CREATE_BANK_ACCOUNT_ERROR,
        ),
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating a bank account. Please try again.",
    };
  }
}

export async function createBankTransactionAction(
  formData: FormData,
): Promise<CreateBankTransactionActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create bank transactions.",
    };
  }

  const bankAccountId = readFormString(formData, "bankAccountId").trim();
  const transactionDate = readFormString(formData, "transactionDate").trim();
  const amountValue = readFormString(formData, "amount").trim();
  const description = readOptionalFormString(formData, "description");
  const transactionType = readOptionalFormString(formData, "transactionType");
  const amount = Number(amountValue);

  if (bankAccountId === "" || !isValidUuid(bankAccountId)) {
    return { ok: false, error: "Select a bank account." };
  }

  if (transactionDate === "") {
    return { ok: false, error: "Transaction date is required." };
  }

  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: "Enter a nonzero amount." };
  }

  if (
    transactionType !== null &&
    !BANK_TRANSACTION_TYPES.includes(
      transactionType as (typeof BANK_TRANSACTION_TYPES)[number],
    )
  ) {
    return { ok: false, error: GENERIC_CREATE_BANK_TRANSACTION_ERROR };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const transaction = await createBankTransaction(organizationId, {
      bankAccountId,
      transactionDate,
      amount,
      description,
      transactionType:
        transactionType as (typeof BANK_TRANSACTION_TYPES)[number] | null,
    });

    revalidatePath("/banking");
    revalidatePath("/transactions");

    return { ok: true, transaction };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error: mapRpcError(
          error,
          CREATE_BANK_TRANSACTION_RPC_ERROR_MESSAGES,
          GENERIC_CREATE_BANK_TRANSACTION_ERROR,
        ),
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while creating a bank transaction. Please try again.",
    };
  }
}

export async function matchBankTransactionAction(
  formData: FormData,
): Promise<MatchBankTransactionActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to match bank transactions.",
    };
  }

  const bankTransactionId = readFormString(formData, "bankTransactionId").trim();
  const matchType = readFormString(formData, "matchType").trim();
  const matchedSourceId = readFormString(formData, "matchedSourceId").trim();

  if (bankTransactionId === "" || !isValidUuid(bankTransactionId)) {
    return { ok: false, error: GENERIC_MATCH_BANK_TRANSACTION_ERROR };
  }

  if (
    matchType === "" ||
    !MATCH_TYPES.includes(matchType as (typeof MATCH_TYPES)[number])
  ) {
    return { ok: false, error: "Select a valid match type." };
  }

  if (matchedSourceId === "" || !isValidUuid(matchedSourceId)) {
    return { ok: false, error: "Enter a valid source identifier." };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const result = await matchBankTransaction(organizationId, {
      bankTransactionId,
      matchType: matchType as (typeof MATCH_TYPES)[number],
      matchedSourceId,
    });

    revalidatePath("/banking");
    revalidatePath("/transactions");

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error: mapRpcError(
          error,
          MATCH_BANK_TRANSACTION_RPC_ERROR_MESSAGES,
          GENERIC_MATCH_BANK_TRANSACTION_ERROR,
        ),
      };
    }

    return {
      ok: false,
      error:
        "Something went wrong while matching the bank transaction. Please try again.",
    };
  }
}
