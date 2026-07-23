import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseRecord } from "@/lib/data/expenses-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

import { ExpenseDetailPageContent } from "./expense-detail-page-content";

const accountOptions = [
  {
    id: "acct-expense-active",
    code: "6100",
    name: "Utilities",
    label: "6100 · Utilities",
  },
];

const fundOptions = [
  {
    id: "fund-active-coded",
    code: "GEN",
    name: "General Fund",
    label: "GEN · General Fund",
  },
];

const creditAccountOptions = [
  {
    id: "acct-liability-card",
    code: "2010",
    name: "Ministry Credit Card",
    accountType: "liability" as const,
    displayLabel: "2010 — Ministry Credit Card",
  },
];

vi.mock("@/components/expenses/record-expense-section", () => ({
  RecordExpenseSection: ({
    allocationComplete,
    creditAccountOptions: options,
    expenseDescription,
  }: {
    allocationComplete: boolean;
    creditAccountOptions: typeof creditAccountOptions;
    expenseDescription: string;
  }) => (
    <section aria-label="Record expense section">
      <p>{expenseDescription}</p>
      <p data-allocation-complete={allocationComplete ? "true" : "false"}>
        {allocationComplete ? "Allocation complete" : "Allocation incomplete"}
      </p>
      <ul>
        {options.map((option) => (
          <li key={option.id}>{option.displayLabel}</li>
        ))}
      </ul>
    </section>
  ),
}));

vi.mock("@/app/(workspace)/expenses/actions", () => ({
  getExpenseDraftLinesAction: vi.fn(),
  replaceExpenseDraftLinesAction: vi.fn(),
  recordExpenseAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createExpense(
  overrides: Partial<ExpenseRecord> & Pick<ExpenseRecord, "id" | "description">,
): ExpenseRecord {
  return {
    id: overrides.id,
    organization_id: TEST_ORGANIZATION_ID,
    vendor_id: overrides.vendor_id ?? "vendor-1",
    vendorName: overrides.vendorName ?? "Northside Supplies",
    expense_date: overrides.expense_date ?? "2026-07-05",
    description: overrides.description,
    total_amount: overrides.total_amount ?? 125.75,
    reference: overrides.reference ?? "EXP-1001",
    payment_source: overrides.payment_source ?? "card",
    status: overrides.status ?? "draft",
    created_at: overrides.created_at ?? "2026-07-05T12:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-05T12:00:00.000Z",
    lineCount: overrides.lineCount ?? 1,
  };
}

function renderDetailPage(
  expense: ExpenseRecord,
  lines: Parameters<typeof ExpenseDetailPageContent>[0]["lines"] = [],
  options: Partial<
    Pick<
      Parameters<typeof ExpenseDetailPageContent>[0],
      "creditAccountOptions"
    >
  > = {},
) {
  return render(
    <ExpenseDetailPageContent
      accountOptions={accountOptions}
      creditAccountOptions={options.creditAccountOptions ?? creditAccountOptions}
      expense={expense}
      fundOptions={fundOptions}
      lines={lines}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ExpenseDetailPageContent", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a single h1 with the expense description", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Office supplies purchase",
      }),
    ).toBeTruthy();
  });

  it("renders existing fields correctly", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        reference: "EXP-1001",
        vendorName: "Northside Supplies",
      }),
    );

    expect(screen.getByText("EXP-1001")).toBeTruthy();
    expect(screen.getByText("Northside Supplies")).toBeTruthy();
    expect(screen.getByText("card")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Office supplies purchase" })
        .closest("section")
        ?.textContent,
    ).toContain("$125.75");
  });

  it("renders the back link pointing to /expenses", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
      }),
    );

    expect(
      screen.getByRole("link", { name: "Back to expenses" }).getAttribute("href"),
    ).toBe("/expenses");
  });

  it("renders draft allocation trigger for draft expenses", () => {
    renderDetailPage(
      createExpense({
        id: "expense-2",
        description: "Utility reimbursement draft",
        status: "draft",
        lineCount: 0,
      }),
    );

    expect(screen.getByRole("button", { name: "Allocate" })).toBeTruthy();
  });

  it("does not render allocation trigger for recorded expenses", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        status: "recorded",
        lineCount: 2,
      }),
    );

    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit allocation" })).toBeNull();
  });

  it("shows read-only messaging for recorded expenses", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        status: "recorded",
      }),
    );

    expect(
      screen.getByText(
        /This expense has been recorded and cannot be edited through the draft workflow/i,
      ),
    ).toBeTruthy();
  });

  it("displays allocation totals correctly", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        total_amount: 100,
        status: "draft",
      }),
      [
        {
          id: "line-1",
          expenseId: "expense-1",
          accountId: "acct-expense-active",
          fundId: "fund-active-coded",
          lineNumber: 1,
          description: "Utilities",
          amount: 40,
        },
      ],
    );

    expect(screen.getByLabelText("Allocation summary").textContent).toContain(
      "$100.00",
    );
    expect(screen.getByLabelText("Allocation summary").textContent).toContain(
      "$40.00",
    );
    expect(screen.getByLabelText("Allocation summary").textContent).toContain(
      "$60.00",
    );
  });

  it("communicates incomplete allocation clearly", () => {
    renderDetailPage(
      createExpense({
        id: "expense-2",
        description: "Utility reimbursement draft",
        total_amount: 240,
        status: "draft",
        lineCount: 0,
      }),
      [],
    );

    expect(
      screen.getByText(/Allocation is incomplete/i),
    ).toBeTruthy();
    expect(screen.getByText("Needs allocation")).toBeTruthy();
  });

  it("renders allocation lines as read-only rows", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        status: "recorded",
      }),
      [
        {
          id: "line-1",
          expenseId: "expense-1",
          accountId: "acct-expense-active",
          fundId: "fund-active-coded",
          lineNumber: 1,
          description: "Utilities",
          amount: 125.75,
        },
      ],
    );

    expect(screen.getByText("Line 1")).toBeTruthy();
    expect(screen.getByText("6100 · Utilities")).toBeTruthy();
    expect(screen.getByText("GEN · General Fund")).toBeTruthy();
    expect(screen.getByText("Utilities")).toBeTruthy();
  });

  it("renders the recording section for complete draft allocation", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        total_amount: 125.75,
        status: "draft",
      }),
      [
        {
          id: "line-1",
          expenseId: "expense-1",
          accountId: "acct-expense-active",
          fundId: "fund-active-coded",
          lineNumber: 1,
          description: "Utilities",
          amount: 125.75,
        },
      ],
    );

    expect(screen.getByLabelText("Record expense section")).toBeTruthy();
    expect(screen.getByText("2010 — Ministry Credit Card")).toBeTruthy();
    expect(screen.getByText("Allocation complete")).toBeTruthy();
  });

  it("does not render the recording section for incomplete draft allocation", () => {
    renderDetailPage(
      createExpense({
        id: "expense-2",
        description: "Utility reimbursement draft",
        total_amount: 240,
        status: "draft",
      }),
      [],
    );

    expect(screen.queryByLabelText("Record expense section")).toBeNull();
  });

  it("does not render the recording section for recorded expenses", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        status: "recorded",
      }),
      [
        {
          id: "line-1",
          expenseId: "expense-1",
          accountId: "acct-expense-active",
          fundId: "fund-active-coded",
          lineNumber: 1,
          description: "Utilities",
          amount: 125.75,
        },
      ],
    );

    expect(screen.queryByLabelText("Record expense section")).toBeNull();
  });

  it("renders the empty eligible-account state through the recording section", () => {
    renderDetailPage(
      createExpense({
        id: "expense-1",
        description: "Office supplies purchase",
        total_amount: 125.75,
        status: "draft",
      }),
      [
        {
          id: "line-1",
          expenseId: "expense-1",
          accountId: "acct-expense-active",
          fundId: "fund-active-coded",
          lineNumber: 1,
          description: "Utilities",
          amount: 125.75,
        },
      ],
      { creditAccountOptions: [] },
    );

    expect(screen.getByLabelText("Record expense section")).toBeTruthy();
    expect(screen.queryByText("2010 — Ministry Credit Card")).toBeNull();
  });
});
