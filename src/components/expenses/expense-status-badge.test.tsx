import { describe, expect, it } from "vitest";

import type { ExpenseRecord } from "@/lib/data/expenses-repository";

import { getExpenseStatusPresentation } from "./expense-status-badge";

function createExpense(
  overrides: Partial<ExpenseRecord> = {},
): ExpenseRecord {
  return {
    id: "expense-1",
    organization_id: "org-1",
    vendor_id: null,
    expense_date: "2026-07-01",
    description: "Office supplies",
    reference: null,
    payment_source: "bank",
    status: "draft",
    total_amount: 25,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    vendorName: null,
    lineCount: 0,
    ...overrides,
  };
}

describe("getExpenseStatusPresentation", () => {
  it("marks recorded expenses as posted to ledger", () => {
    expect(
      getExpenseStatusPresentation(
        createExpense({ status: "recorded", lineCount: 1 }),
      ),
    ).toBe("posted-to-ledger");
  });

  it("marks draft expenses without lines as needing allocation", () => {
    expect(
      getExpenseStatusPresentation(createExpense({ lineCount: 0 })),
    ).toBe("needs-allocation");
  });

  it("marks allocated drafts as ready to post", () => {
    expect(
      getExpenseStatusPresentation(createExpense({ lineCount: 2 })),
    ).toBe("ready-to-post");
  });
});
