"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createExpenseDraft,
  getExpenseDraftLines,
  recordExpense,
  replaceExpenseDraftLines,
  type ExpenseDraftLineDetail,
  type ExpensePaymentSource,
} from "@/lib/data/expenses-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_CREATE_EXPENSE_DRAFT_ERROR =
  "Unable to create expense draft. Please verify the information and try again.";

const GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR =
  "Unable to update expense allocation. Please verify the information and try again.";

const GENERIC_GET_EXPENSE_DRAFT_LINES_ERROR =
  "Unable to load expense allocation. Please try again.";

const GENERIC_RECORD_EXPENSE_ERROR =
  "The expense could not be recorded. Please try again.";

const RECORD_EXPENSE_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Expense is not in draft status":
    "This expense has already been recorded or is no longer editable.",
  "Insufficient role to record expense":
    "You do not have permission to record this expense.",
  "Accounting period is closed":
    "This expense cannot be recorded because its accounting period is closed.",
  "Credit account does not belong to organization":
    "The selected payment account is not available for this organization.",
  "Credit account type is not allowed":
    "The selected payment account cannot be used for this expense.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const MAX_ALLOCATION_LINES = 50;
const MAX_ALLOCATION_AMOUNT_EXCLUSIVE = 1e16;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ALLOCATION_LINE_KEYS = new Set([
  "accountId",
  "fundId",
  "amount",
  "description",
]);

const ALLOWED_GET_EXPENSE_DRAFT_LINES_KEYS = new Set(["expenseId"]);

const ALLOWED_RECORD_EXPENSE_KEYS = new Set(["expenseId", "creditAccountId"]);

const EXPENSE_PAYMENT_SOURCES: readonly ExpensePaymentSource[] = [
  "bank",
  "card",
  "cash",
  "reimbursement",
  "other",
];

export type CreateExpenseDraftActionInput = {
  expenseDate: string;
  description: string;
  totalAmount: number;
  vendorId?: string | null;
  reference?: string | null;
  paymentSource: ExpensePaymentSource;
};

export type CreateExpenseDraftActionResult =
  | {
      success: true;
      expenseId: string;
    }
  | {
      success: false;
      message: string;
    };

export type ReplaceExpenseDraftLinesActionInput = {
  expenseId: string;
  lines: Array<{
    accountId: string;
    fundId?: string | null;
    amount: number;
    description?: string | null;
  }>;
};

export type ReplaceExpenseDraftLinesActionResult =
  | {
      success: true;
      expenseId: string;
      totalAmount: number;
    }
  | {
      success: false;
      message: string;
    };

export type GetExpenseDraftLinesActionInput = {
  expenseId: string;
};

export type GetExpenseDraftLinesActionResult =
  | {
      success: true;
      expenseId: string;
      lines: ExpenseDraftLineDetail[];
    }
  | {
      success: false;
      message: string;
    };

export type RecordExpenseActionInput = {
  expenseId: string;
  creditAccountId: string;
};

export type RecordExpenseActionResult =
  | {
      success: true;
      expenseId: string;
      status: "recorded";
      journalEntryId: string | null;
    }
  | {
      success: false;
      fieldErrors?: {
        expenseId?: string;
        creditAccountId?: string;
      };
      message: string;
    };

type ValidatedReplaceExpenseDraftLineInput = {
  accountId: string;
  fundId: string | null;
  amount: number;
  description: string | null;
};

type ValidatedReplaceExpenseDraftLinesInput = {
  expenseId: string;
  lines: ValidatedReplaceExpenseDraftLineInput[];
};

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

function isExpensePaymentSource(value: string): value is ExpensePaymentSource {
  return EXPENSE_PAYMENT_SOURCES.includes(value as ExpensePaymentSource);
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function mapRecordExpenseError(error: DataAccessError): string {
  return (
    RECORD_EXPENSE_RPC_ERROR_MESSAGES[error.message] ??
    GENERIC_RECORD_EXPENSE_ERROR
  );
}

function hasAtMostTwoDecimalPlaces(amount: number): boolean {
  return Math.round(amount * 100) === amount * 100;
}

function parseExpenseTotalAmount(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function validateReplaceExpenseDraftLinesInput(
  input: ReplaceExpenseDraftLinesActionInput,
): ReplaceExpenseDraftLinesActionResult | ValidatedReplaceExpenseDraftLinesInput {
  const expenseId = input.expenseId.trim();

  if (expenseId === "" || !isValidUuid(expenseId)) {
    return {
      success: false,
      message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
    };
  }

  if (!Array.isArray(input.lines)) {
    return {
      success: false,
      message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
    };
  }

  if (input.lines.length < 1 || input.lines.length > MAX_ALLOCATION_LINES) {
    return {
      success: false,
      message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
    };
  }

  const validatedLines: ValidatedReplaceExpenseDraftLineInput[] = [];

  for (const line of input.lines) {
    if (line == null || typeof line !== "object" || Array.isArray(line)) {
      return {
        success: false,
        message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
      };
    }

    for (const key of Object.keys(line)) {
      if (!ALLOWED_ALLOCATION_LINE_KEYS.has(key)) {
        return {
          success: false,
          message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
        };
      }
    }

    const accountId = line.accountId.trim();

    if (accountId === "" || !isValidUuid(accountId)) {
      return {
        success: false,
        message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
      };
    }

    let fundId: string | null = null;

    if (line.fundId != null) {
      const trimmedFundId = String(line.fundId).trim();

      if (trimmedFundId === "") {
        fundId = null;
      } else if (!isValidUuid(trimmedFundId)) {
        return {
          success: false,
          message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
        };
      } else {
        fundId = trimmedFundId;
      }
    }

    const amount = line.amount;

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !hasAtMostTwoDecimalPlaces(amount) ||
      amount >= MAX_ALLOCATION_AMOUNT_EXCLUSIVE
    ) {
      return {
        success: false,
        message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
      };
    }

    let description: string | null = null;

    if (line.description != null) {
      const trimmedDescription = String(line.description).trim();

      if (trimmedDescription === "") {
        return {
          success: false,
          message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
        };
      }

      description = trimmedDescription;
    }

    validatedLines.push({
      accountId,
      fundId,
      amount,
      description,
    });
  }

  return {
    expenseId,
    lines: validatedLines,
  };
}

function validateGetExpenseDraftLinesInput(
  input: GetExpenseDraftLinesActionInput,
): GetExpenseDraftLinesActionResult | string {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      message: GENERIC_GET_EXPENSE_DRAFT_LINES_ERROR,
    };
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_GET_EXPENSE_DRAFT_LINES_KEYS.has(key)) {
      return {
        success: false,
        message: GENERIC_GET_EXPENSE_DRAFT_LINES_ERROR,
      };
    }
  }

  const expenseId = input.expenseId.trim();

  if (expenseId === "" || !isValidUuid(expenseId)) {
    return {
      success: false,
      message: GENERIC_GET_EXPENSE_DRAFT_LINES_ERROR,
    };
  }

  return expenseId;
}

type ValidatedRecordExpenseInput = {
  expenseId: string;
  creditAccountId: string;
};

function validateRecordExpenseInput(
  input: RecordExpenseActionInput,
): RecordExpenseActionResult | ValidatedRecordExpenseInput {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      message: GENERIC_RECORD_EXPENSE_ERROR,
    };
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_RECORD_EXPENSE_KEYS.has(key)) {
      return {
        success: false,
        message: GENERIC_RECORD_EXPENSE_ERROR,
      };
    }
  }

  const expenseId = input.expenseId.trim();
  const creditAccountId = input.creditAccountId.trim();
  const fieldErrors: NonNullable<
    Extract<RecordExpenseActionResult, { success: false }>["fieldErrors"]
  > = {};

  if (expenseId === "" || !isValidUuid(expenseId)) {
    fieldErrors.expenseId = "Enter a valid expense identifier.";
  }

  if (creditAccountId === "" || !isValidUuid(creditAccountId)) {
    fieldErrors.creditAccountId = "Enter a valid payment account.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      fieldErrors,
      message: GENERIC_RECORD_EXPENSE_ERROR,
    };
  }

  return {
    expenseId,
    creditAccountId,
  };
}

function validateCreateExpenseDraftInput(
  input: CreateExpenseDraftActionInput,
): CreateExpenseDraftActionResult | null {
  const expenseDate = input.expenseDate.trim();

  if (expenseDate === "") {
    return {
      success: false,
      message: "Expense date is required.",
    };
  }

  const description = input.description.trim();

  if (description === "") {
    return {
      success: false,
      message: "Expense description is required.",
    };
  }

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    return {
      success: false,
      message: GENERIC_CREATE_EXPENSE_DRAFT_ERROR,
    };
  }

  if (!isExpensePaymentSource(input.paymentSource)) {
    return {
      success: false,
      message: GENERIC_CREATE_EXPENSE_DRAFT_ERROR,
    };
  }

  return null;
}

export async function createExpenseDraftAction(
  input: CreateExpenseDraftActionInput,
): Promise<CreateExpenseDraftActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to create expenses.",
    };
  }

  const validationFailure = validateCreateExpenseDraftInput(input);

  if (validationFailure) {
    return validationFailure;
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const expense = await createExpenseDraft(organizationId, {
      expenseDate: input.expenseDate.trim(),
      description: input.description.trim(),
      totalAmount: input.totalAmount,
      vendorId: normalizeOptionalString(input.vendorId),
      reference: normalizeOptionalString(input.reference),
      paymentSource: input.paymentSource,
    });

    revalidatePath("/expenses");

    return {
      success: true,
      expenseId: expense.id,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: GENERIC_CREATE_EXPENSE_DRAFT_ERROR,
      };
    }

    return {
      success: false,
      message:
        "Something went wrong while creating an expense draft. Please try again.",
    };
  }
}

export async function replaceExpenseDraftLinesAction(
  input: ReplaceExpenseDraftLinesActionInput,
): Promise<ReplaceExpenseDraftLinesActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to update expense allocation.",
    };
  }

  const validationResult = validateReplaceExpenseDraftLinesInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedReplaceExpenseDraftLinesInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const expense = await replaceExpenseDraftLines(organizationId, {
      expenseId: validatedInput.expenseId,
      lines: validatedInput.lines.map((line) => ({
        accountId: line.accountId,
        fundId: line.fundId,
        amount: line.amount,
        description: line.description,
      })),
    });

    revalidatePath("/expenses");

    return {
      success: true,
      expenseId: expense.id,
      totalAmount: parseExpenseTotalAmount(expense.total_amount),
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: GENERIC_REPLACE_EXPENSE_DRAFT_LINES_ERROR,
      };
    }

    return {
      success: false,
      message:
        "Something went wrong while updating expense allocation. Please try again.",
    };
  }
}

export async function getExpenseDraftLinesAction(
  input: GetExpenseDraftLinesActionInput,
): Promise<GetExpenseDraftLinesActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to view expense allocation.",
    };
  }

  const validationResult = validateGetExpenseDraftLinesInput(input);

  if (typeof validationResult !== "string") {
    return validationResult;
  }

  const validatedExpenseId = validationResult;

  try {
    const organizationId = await getCurrentOrganizationId();
    const lines = await getExpenseDraftLines(
      organizationId,
      validatedExpenseId,
    );

    return {
      success: true,
      expenseId: validatedExpenseId,
      lines,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: GENERIC_GET_EXPENSE_DRAFT_LINES_ERROR,
      };
    }

    return {
      success: false,
      message:
        "Something went wrong while loading expense allocation. Please try again.",
    };
  }
}

export async function recordExpenseAction(
  input: RecordExpenseActionInput,
): Promise<RecordExpenseActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to record expenses.",
    };
  }

  const validationResult = validateRecordExpenseInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult as ValidatedRecordExpenseInput;

  try {
    const organizationId = await getCurrentOrganizationId();
    const expense = await recordExpense(
      organizationId,
      validatedInput.expenseId,
      validatedInput.creditAccountId,
    );

    revalidatePath("/expenses");
    revalidatePath(`/expenses/${validatedInput.expenseId}`);

    return {
      success: true,
      expenseId: expense.id,
      status: "recorded",
      journalEntryId: expense.journal_entry_id ?? null,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapRecordExpenseError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_RECORD_EXPENSE_ERROR,
    };
  }
}
