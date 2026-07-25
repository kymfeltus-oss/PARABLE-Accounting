import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseRecord, ExpensesData } from "@/lib/data/expenses-repository";
import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";
import {
  createEmptyExpensesData,
  createPopulatedExpensesData,
} from "@/lib/data/test/expenses-data-fixtures";

import { ExpensesPageContent } from "./expenses-page-content";

const PAGE_CONTENT_PATH = path.join(
  process.cwd(),
  "src/components/expenses/expenses-page-content.tsx",
);

const vendorOptions = [
  { id: "vendor-1", name: "Northside Supplies" },
  { id: "vendor-2", name: "City Utilities" },
];

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

vi.mock("@/app/(workspace)/expenses/actions", () => ({
  createExpenseDraftAction: vi.fn(),
  getExpenseDraftLinesAction: vi.fn(),
  replaceExpenseDraftLinesAction: vi.fn(),
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

function createExpenseRecord(
  overrides: Partial<ExpenseRecord> & Pick<ExpenseRecord, "id" | "description">,
): ExpenseRecord {
  return {
    id: overrides.id,
    organization_id: TEST_ORGANIZATION_ID,
    vendor_id: overrides.vendor_id ?? null,
    vendorName: overrides.vendorName ?? null,
    expense_date: overrides.expense_date ?? "2026-07-01",
    description: overrides.description,
    total_amount: overrides.total_amount ?? 100,
    reference: overrides.reference ?? null,
    payment_source: overrides.payment_source ?? "card",
    status: overrides.status ?? "draft",
    created_at: overrides.created_at ?? "2026-07-01T12:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-07-01T12:00:00.000Z",
    lineCount: overrides.lineCount ?? 0,
  };
}

function createManyExpensesData(expenseCount: number): ExpensesData {
  const expenses = Array.from({ length: expenseCount }, (_, index) =>
    createExpenseRecord({
      id: `expense-${index + 1}`,
      description: `Expense item ${index + 1}`,
      reference: `REF-${String(index + 1).padStart(3, "0")}`,
      expense_date: `2026-07-${String(Math.min(index + 1, 28)).padStart(2, "0")}`,
      created_at: `2026-07-${String(Math.min(index + 1, 28)).padStart(2, "0")}T12:00:00.000Z`,
      status: index % 2 === 0 ? "recorded" : "draft",
      lineCount: index % 2 === 0 ? 2 : 1,
    }),
  );

  return {
    organizationId: TEST_ORGANIZATION_ID,
    expenses,
    counts: {
      total: expenseCount,
      thisMonth: expenseCount,
    },
    summary: {
      totalAmount: expenseCount * 100,
      amountThisMonth: expenseCount * 100,
    },
  };
}

function renderExpensesPage(data: ExpensesData) {
  return render(
    <ExpensesPageContent
      data={data}
      vendorOptions={vendorOptions}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("ExpensesPageContent", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the page heading", () => {
    renderExpensesPage(createEmptyExpensesData());

    expect(
      screen.getByRole("heading", { level: 1, name: "Expenses" }),
    ).toBeTruthy();
  });

  it("renders the New Expense control", () => {
    renderExpensesPage(createEmptyExpensesData());

    expect(screen.getByRole("button", { name: "New Expense" })).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = renderExpensesPage(createEmptyExpensesData());

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    renderExpensesPage(createEmptyExpensesData());

    expect(screen.getAllByText("No expenses yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No draft expenses.")).toBeTruthy();
  });

  it("renders live expense props", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
    expect(screen.getByText("EXP-1001")).toBeTruthy();
    expect(screen.getByText("Northside Supplies")).toBeTruthy();
    expect(
      screen.getByText("Total Expenses").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByText(/2 allocation lines/)).toBeTruthy();
  });

  it("renders all expenses, not only the first 10", () => {
    renderExpensesPage(createManyExpensesData(12));

    expect(screen.getByText("Expense item 1")).toBeTruthy();
    expect(screen.getByText("Expense item 11")).toBeTruthy();
    expect(screen.getByText("Expense item 12")).toBeTruthy();
  });

  it("filters draft expenses only", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.click(screen.getByRole("button", { name: "Draft (1)" }));

    expect(screen.getByText("Utility reimbursement draft")).toBeTruthy();
    expect(screen.queryByText("Office supplies purchase")).toBeNull();
  });

  it("filters recorded expenses only", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.click(screen.getByRole("button", { name: "Recorded (1)" }));

    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();
  });

  it("searches expenses by description", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "office supplies" },
    });

    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();
  });

  it("searches expenses by reference", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "EXP-1001" },
    });

    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();
  });

  it("searches expenses case-insensitively", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "utility reimbursement" },
    });

    expect(screen.getByText("Utility reimbursement draft")).toBeTruthy();
    expect(screen.queryByText("Office supplies purchase")).toBeNull();
  });

  it("trims search whitespace before filtering", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "   office supplies   " },
    });

    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();
  });

  it("combines search and status filters correctly", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.click(screen.getByRole("button", { name: "Draft (1)" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "office" },
    });

    expect(screen.getByText("No expenses match the current search and status filter.")).toBeTruthy();
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();
    expect(screen.queryByText("Office supplies purchase")).toBeNull();
  });

  it("restores results when search is cleared", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "office supplies" },
    });
    expect(screen.queryByText("Utility reimbursement draft")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.getByText("Utility reimbursement draft")).toBeTruthy();
    expect(screen.getByText("Office supplies purchase")).toBeTruthy();
  });

  it("shows the no-expenses empty state when there is no activity", () => {
    renderExpensesPage(createEmptyExpensesData());

    expect(
      screen.getByText("No expenses yet. Create an expense draft to get started."),
    ).toBeTruthy();
  });

  it("shows the no-search-results empty state", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "does-not-exist" },
    });

    expect(
      screen.getByText("No expenses match your search. Clear the search field to restore results."),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Clear search" }).length).toBe(1);
  });

  it("shows the no-status-results empty state", () => {
    const onlyRecordedData: ExpensesData = {
      ...createPopulatedExpensesData(),
      expenses: [
        createExpenseRecord({
          id: "expense-recorded-only",
          description: "Recorded only expense",
          status: "recorded",
          lineCount: 1,
        }),
      ],
      counts: { total: 1, thisMonth: 1 },
      summary: { totalAmount: 100, amountThisMonth: 100 },
    };

    renderExpensesPage(onlyRecordedData);

    fireEvent.click(screen.getByRole("button", { name: "Draft (0)" }));

    expect(
      screen.getByText("No expenses match the selected status filter."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show all expenses" })).toBeTruthy();
  });

  it("exposes accessible selected filter state", () => {
    renderExpensesPage(createPopulatedExpensesData());

    const allButton = screen.getByRole("button", { name: "All (2)" });
    const draftButton = screen.getByRole("button", { name: "Draft (1)" });

    expect(allButton.getAttribute("aria-pressed")).toBe("true");
    expect(draftButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(draftButton);

    expect(allButton.getAttribute("aria-pressed")).toBe("false");
    expect(draftButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("still renders draft allocation controls in the expense list", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getByRole("button", { name: "Allocate" })).toBeTruthy();
  });

  it("does not expose allocation controls for recorded expenses", () => {
    renderExpensesPage(createPopulatedExpensesData());

    fireEvent.click(screen.getByRole("button", { name: "Recorded (1)" }));

    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit allocation" })).toBeNull();
  });

  it("does not duplicate full expense records inside Needs Attention", () => {
    renderExpensesPage(createPopulatedExpensesData());

    const attentionSection = screen
      .getByRole("heading", { name: "Needs Attention" })
      .closest("section");

    expect(attentionSection?.textContent).toMatch(/1 draft expense awaiting recording/);
    expect(attentionSection?.textContent).toMatch(/still need allocation/);
    expect(attentionSection?.querySelector('[role="button"]')).toBeNull();
    expect(attentionSection?.textContent).not.toContain("Utility reimbursement draft");
  });

  it("does not render void expenses in the expense list", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.queryByText("Voided duplicate entry")).toBeNull();
  });

  it("does not fabricate unsupported receipt or approval values", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.queryByText(/receipt verification/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    renderExpensesPage(createEmptyExpensesData());

    expect(screen.getByRole("link", { name: /Bills/i }).getAttribute("href")).toBe(
      "/bills",
    );
    expect(
      screen.getByRole("link", { name: /Vendors/i }).getAttribute("href"),
    ).toBe("/vendors");
    expect(
      screen.getByRole("link", { name: /Banking/i }).getAttribute("href"),
    ).toBe("/banking");
  });

  it("passes supplied vendor options to the create form without client-side fetching", () => {
    const contents = readFileSync(PAGE_CONTENT_PATH, "utf8");

    expect(contents).toContain("vendorOptions={vendorOptions}");
    expect(contents).toContain("accountOptions={accountOptions}");
    expect(contents).toContain("fundOptions={fundOptions}");
    expect(contents).toContain("ExpenseAllocationEditor");
    expect(contents).not.toContain("createBrowserSupabaseClient");
    expect(contents).not.toContain("createServerSupabaseClient");
    expect(contents).not.toMatch(/fetch\(/);
    expect(contents).not.toContain("@/lib/supabase/admin");
  });

  it("does not accept organizationId from page content props", () => {
    const contents = readFileSync(PAGE_CONTENT_PATH, "utf8");

    expect(contents).not.toMatch(/organizationId:\s*string/);
    expect(contents).not.toContain("PARABLE_ORGANIZATION_ID");
  });

  it("does not add role mutation or client-side authorization bypass logic", () => {
    const contents = readFileSync(PAGE_CONTENT_PATH, "utf8");

    expect(contents).not.toMatch(/has_org_role/);
    expect(contents).not.toMatch(/currentUserRole/);
    expect(contents).not.toMatch(/viewer/i);
  });

  it("shows Needs allocation status for draft expenses with zero lines", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getByText("Needs allocation")).toBeTruthy();
  });

  it("shows Ready to post and Post to ledger for allocated drafts", () => {
    const base = createPopulatedExpensesData();
    const data: ExpensesData = {
      ...base,
      expenses: [
        ...base.expenses,
        createExpenseRecord({
          id: "expense-ready",
          description: "Allocated draft ready to post",
          status: "draft",
          lineCount: 2,
        }),
      ],
    };

    renderExpensesPage(data);

    expect(screen.getByText("Ready to post")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Post to ledger" }),
    ).toHaveAttribute("href", "/expenses/expense-ready");
  });

  it("shows Posted to ledger for recorded expenses", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getByText("Posted to ledger")).toBeTruthy();
  });

  it("keeps the New Expense flow available alongside allocation controls", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getByRole("button", { name: "New Expense" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Allocate" })).toBeTruthy();
  });

  it("exposes a View action for each expense", () => {
    renderExpensesPage(createPopulatedExpensesData());

    expect(screen.getAllByRole("link", { name: "View" })).toHaveLength(2);
  });

  it("links each View action to the expense detail route", () => {
    renderExpensesPage(createPopulatedExpensesData());

    const viewLinks = screen.getAllByRole("link", { name: "View" });

    expect(viewLinks[0]?.getAttribute("href")).toBe("/expenses/expense-2");
    expect(viewLinks[1]?.getAttribute("href")).toBe("/expenses/expense-1");
  });

  it("keeps the allocation trigger separate from the View action", () => {
    renderExpensesPage(createPopulatedExpensesData());

    const viewLink = screen.getAllByRole("link", { name: "View" })[1];
    const allocateButton = screen.getByRole("button", { name: "Allocate" });

    expect(viewLink?.tagName).toBe("A");
    expect(allocateButton.tagName).toBe("BUTTON");
    expect(viewLink?.closest("a")?.querySelector("button")).toBeNull();
  });
});
