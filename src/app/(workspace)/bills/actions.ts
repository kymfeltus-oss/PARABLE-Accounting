"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  createBill,
  openBill,
  payBill,
  voidBill,
  type BillStatus,
} from "@/lib/data/bills-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";

const GENERIC_CREATE_BILL_ERROR =
  "Unable to create bill. Please verify the information and try again.";

const GENERIC_OPEN_BILL_ERROR =
  "Unable to open this bill. Please try again.";

const GENERIC_PAY_BILL_ERROR =
  "Unable to pay this bill. Please try again.";

const GENERIC_VOID_BILL_ERROR =
  "Unable to void this bill. Please try again.";

const CREATE_BILL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Insufficient role to create bill":
    "You do not have permission to create bills.",
  "Vendor does not belong to organization":
    "The selected vendor is not available for this organization.",
  "Total amount must be greater than zero":
    "Enter an amount greater than zero.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const PAY_BILL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Bill is not in open status":
    "Only open bills can be paid.",
  "Insufficient role to pay bill":
    "You do not have permission to pay this bill.",
  "Accounting period is closed":
    "This bill cannot be paid because its accounting period is closed.",
  "Cash account does not belong to organization":
    "The selected cash account is not available for this organization.",
  "Expense account does not belong to organization":
    "The selected expense account is not available for this organization.",
  "Authenticated user is required":
    "Your session has expired. Please sign in again.",
};

const OPEN_BILL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Bill is not in draft status":
    "Only draft bills can be opened.",
  "Insufficient role to open bill":
    "You do not have permission to open this bill.",
};

const VOID_BILL_RPC_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  "Bill cannot be voided in its current status":
    "This bill cannot be voided in its current status.",
  "Paid bills cannot be voided":
    "Paid bills cannot be voided.",
  "Insufficient role to void bill":
    "You do not have permission to void this bill.",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BILL_STATUSES: readonly BillStatus[] = ["draft", "open"];

export type CreateBillActionInput = {
  vendorId: string;
  billDate: string;
  totalAmount: number;
  billNumber?: string | null;
  dueDate?: string | null;
  description?: string | null;
  status?: BillStatus;
  expenseAccountId?: string | null;
  fundId?: string | null;
};

export type CreateBillActionResult =
  | { success: true; billId: string }
  | { success: false; message: string };

export type OpenBillActionInput = {
  billId: string;
};

export type OpenBillActionResult =
  | { success: true; billId: string; status: "open" }
  | { success: false; message: string };

export type PayBillActionInput = {
  billId: string;
  paymentDate: string;
  cashAccountId: string;
  expenseAccountId: string;
  fundId?: string | null;
};

export type PayBillActionResult =
  | { success: true; billId: string; status: "paid" }
  | { success: false; message: string };

export type VoidBillActionInput = {
  billId: string;
};

export type VoidBillActionResult =
  | { success: true; billId: string; status: "void" }
  | { success: false; message: string };

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isValidBillStatus(value: string): value is BillStatus {
  return BILL_STATUSES.includes(value as BillStatus);
}

function mapCreateBillError(error: DataAccessError): string {
  return CREATE_BILL_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_CREATE_BILL_ERROR;
}

function mapOpenBillError(error: DataAccessError): string {
  return OPEN_BILL_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_OPEN_BILL_ERROR;
}

function mapPayBillError(error: DataAccessError): string {
  return PAY_BILL_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_PAY_BILL_ERROR;
}

function mapVoidBillError(error: DataAccessError): string {
  return VOID_BILL_RPC_ERROR_MESSAGES[error.message] ?? GENERIC_VOID_BILL_ERROR;
}

function validateCreateBillInput(
  input: CreateBillActionInput,
): CreateBillActionResult | CreateBillActionInput {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  const vendorId = input.vendorId.trim();
  const billDate = input.billDate.trim();

  if (vendorId === "" || !isValidUuid(vendorId)) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  if (billDate === "") {
    return { success: false, message: "Bill date is required." };
  }

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  const status = input.status ?? "draft";
  if (!isValidBillStatus(status)) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  const expenseAccountId = input.expenseAccountId?.trim() ?? "";
  if (expenseAccountId !== "" && !isValidUuid(expenseAccountId)) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  const fundId = input.fundId?.trim() ?? "";
  if (fundId !== "" && !isValidUuid(fundId)) {
    return { success: false, message: GENERIC_CREATE_BILL_ERROR };
  }

  return {
    vendorId,
    billDate,
    totalAmount: input.totalAmount,
    billNumber:
      input.billNumber === undefined || input.billNumber === null
        ? null
        : input.billNumber.trim() === ""
          ? null
          : input.billNumber.trim(),
    dueDate:
      input.dueDate === undefined || input.dueDate === null
        ? null
        : input.dueDate.trim() === ""
          ? null
          : input.dueDate.trim(),
    description:
      input.description === undefined || input.description === null
        ? null
        : input.description.trim() === ""
          ? null
          : input.description.trim(),
    status,
    expenseAccountId: expenseAccountId === "" ? null : expenseAccountId,
    fundId: fundId === "" ? null : fundId,
  };
}

export async function createBillAction(
  input: CreateBillActionInput,
): Promise<CreateBillActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to create bills.",
    };
  }

  const validationResult = validateCreateBillInput(input);

  if ("success" in validationResult) {
    return validationResult;
  }

  const validatedInput = validationResult;

  try {
    const organizationId = await getCurrentOrganizationId();
    const bill = await createBill(organizationId, validatedInput);

    revalidatePath("/bills");

    return {
      success: true,
      billId: bill.id,
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapCreateBillError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_CREATE_BILL_ERROR,
    };
  }
}

export async function openBillAction(
  input: OpenBillActionInput,
): Promise<OpenBillActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to open bills.",
    };
  }

  const billId = input.billId.trim();

  if (billId === "" || !isValidUuid(billId)) {
    return { success: false, message: GENERIC_OPEN_BILL_ERROR };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const bill = await openBill(organizationId, billId);

    revalidatePath("/bills");

    return {
      success: true,
      billId: bill.id,
      status: "open",
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapOpenBillError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_OPEN_BILL_ERROR,
    };
  }
}

export async function payBillAction(
  input: PayBillActionInput,
): Promise<PayBillActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to pay bills.",
    };
  }

  const billId = input.billId.trim();
  const paymentDate = input.paymentDate.trim();
  const cashAccountId = input.cashAccountId.trim();
  const expenseAccountId = input.expenseAccountId.trim();
  const fundId = input.fundId?.trim() ?? "";

  if (
    billId === "" ||
    paymentDate === "" ||
    cashAccountId === "" ||
    expenseAccountId === "" ||
    !isValidUuid(billId) ||
    !isValidUuid(cashAccountId) ||
    !isValidUuid(expenseAccountId)
  ) {
    return { success: false, message: GENERIC_PAY_BILL_ERROR };
  }

  if (fundId !== "" && !isValidUuid(fundId)) {
    return { success: false, message: GENERIC_PAY_BILL_ERROR };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const bill = await payBill(organizationId, {
      billId,
      paymentDate,
      cashAccountId,
      expenseAccountId,
      fundId: fundId === "" ? null : fundId,
    });

    revalidatePath("/bills");

    return {
      success: true,
      billId: bill.id,
      status: "paid",
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapPayBillError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_PAY_BILL_ERROR,
    };
  }
}

export async function voidBillAction(
  input: VoidBillActionInput,
): Promise<VoidBillActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      success: false,
      message: "You must be signed in to void bills.",
    };
  }

  const billId = input.billId.trim();

  if (billId === "" || !isValidUuid(billId)) {
    return { success: false, message: GENERIC_VOID_BILL_ERROR };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const bill = await voidBill(organizationId, billId);

    revalidatePath("/bills");

    return {
      success: true,
      billId: bill.id,
      status: "void",
    };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        success: false,
        message: mapVoidBillError(error),
      };
    }

    return {
      success: false,
      message: GENERIC_VOID_BILL_ERROR,
    };
  }
}
