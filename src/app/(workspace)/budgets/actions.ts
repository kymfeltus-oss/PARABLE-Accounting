"use server";

import { revalidatePath } from "next/cache";

import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { DataAccessError } from "@/lib/data/data-access-error";
import {
  activateBudget,
  createBudget,
  upsertBudgetLine,
} from "@/lib/data/budgets-repository";
import { getCurrentOrganizationId } from "@/lib/data/organization-context";
import type { BudgetLineRow, BudgetRow } from "@/lib/data/types/rows";

const GENERIC_CREATE_BUDGET_ERROR =
  "Unable to create budget. Please verify the information and your access, then try again.";

const GENERIC_UPSERT_LINE_ERROR =
  "Unable to save budget line. Please verify the information and your access, then try again.";

const GENERIC_ACTIVATE_BUDGET_ERROR =
  "Unable to activate budget. Please verify your access and try again.";

export type CreateBudgetActionResult =
  | { ok: true; budget: BudgetRow }
  | { ok: false; error: string };

export type UpsertBudgetLineActionResult =
  | { ok: true; line: BudgetLineRow }
  | { ok: false; error: string };

export type ActivateBudgetActionResult =
  | { ok: true; budget: BudgetRow }
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

function readFormAmount(formData: FormData, field: string): number {
  const value = readFormString(formData, field).trim();

  if (value === "") {
    return Number.NaN;
  }

  return Number(value);
}

export async function createBudgetAction(
  formData: FormData,
): Promise<CreateBudgetActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to create budgets.",
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const budget = await createBudget(organizationId, {
      name: readFormString(formData, "name"),
      startDate: readFormString(formData, "startDate"),
      endDate: readFormString(formData, "endDate"),
      status: readOptionalFormString(formData, "status") ?? "draft",
    });

    revalidatePath("/budgets");
    revalidatePath("/reports");

    return { ok: true, budget };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "name is required") {
        return {
          ok: false,
          error: "Budget name is required.",
        };
      }

      if (error.message === "dates are required") {
        return {
          ok: false,
          error: "Budget start and end dates are required.",
        };
      }

      if (error.message === "start date must be on or before end date") {
        return {
          ok: false,
          error: "Budget start date must be on or before the end date.",
        };
      }

      return {
        ok: false,
        error: GENERIC_CREATE_BUDGET_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while creating a budget. Please try again.",
    };
  }
}

export async function upsertBudgetLineAction(
  formData: FormData,
): Promise<UpsertBudgetLineActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to add budget lines.",
    };
  }

  const budgetId = readFormString(formData, "budgetId").trim();

  if (budgetId === "") {
    return {
      ok: false,
      error: GENERIC_UPSERT_LINE_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const line = await upsertBudgetLine(organizationId, {
      budgetId,
      accountId: readFormString(formData, "accountId"),
      amount: readFormAmount(formData, "amount"),
      fundId: readOptionalFormString(formData, "fundId"),
    });

    revalidatePath("/budgets");
    revalidatePath("/reports");

    return { ok: true, line };
  } catch (error) {
    if (error instanceof DataAccessError) {
      if (error.message === "accountId is required") {
        return {
          ok: false,
          error: "Account is required.",
        };
      }

      if (error.message === "amount must be zero or greater") {
        return {
          ok: false,
          error: "Amount must be zero or greater.",
        };
      }

      return {
        ok: false,
        error: GENERIC_UPSERT_LINE_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while saving the budget line. Please try again.",
    };
  }
}

export async function activateBudgetAction(
  formData: FormData,
): Promise<ActivateBudgetActionResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      error: "You must be signed in to activate budgets.",
    };
  }

  const budgetId = readFormString(formData, "budgetId").trim();

  if (budgetId === "") {
    return {
      ok: false,
      error: GENERIC_ACTIVATE_BUDGET_ERROR,
    };
  }

  try {
    const organizationId = await getCurrentOrganizationId();
    const budget = await activateBudget(organizationId, budgetId);

    revalidatePath("/budgets");
    revalidatePath("/reports");

    return { ok: true, budget };
  } catch (error) {
    if (error instanceof DataAccessError) {
      return {
        ok: false,
        error: GENERIC_ACTIVATE_BUDGET_ERROR,
      };
    }

    return {
      ok: false,
      error: "Something went wrong while activating the budget. Please try again.",
    };
  }
}
