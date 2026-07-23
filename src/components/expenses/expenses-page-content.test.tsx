import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Expenses" }),
    ).toBeTruthy();
  });

  it('renders the "New Expense" control', () => {
    render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByRole("button", { name: "New Expense" })).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getAllByText("No expenses yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No draft expenses.")).toBeTruthy();
  });

  it("renders live expense props", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByText(/Northside Supplies · EXP-1001/)).toBeTruthy();
    expect(
      screen.getByText("Total Expenses").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Expenses This Month").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByText(/2 allocation lines/)).toBeTruthy();
  });

  it("renders honest zero counts when expenses data is empty", () => {
    render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(
      screen.getByText("Total Expenses").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Total Amount").closest("article")?.textContent,
    ).toContain("$0.00");
  });

  it("does not render void expenses in the recent list", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.queryByText(/Voided duplicate entry/)).toBeNull();
  });

  it("renders draft expenses in the attention area", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Needs Attention" }).closest("section")
        ?.textContent,
    ).toMatch(/Utility reimbursement draft/);
    expect(screen.queryByText("No draft expenses.")).toBeNull();
  });

  it("does not fabricate unsupported receipt or approval values", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.queryByText(/receipt verification/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
    expect(screen.queryByText(/AI classification/i)).toBeNull();
    expect(screen.queryByText(/1099/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(
      <ExpensesPageContent
        data={createEmptyExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

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

  it("passes accountOptions and fundOptions into the allocation editor wiring", () => {
    const contents = readFileSync(PAGE_CONTENT_PATH, "utf8");

    expect(contents).toContain("renderDraftAllocationControls(");
    expect(contents).toContain("accountOptions={accountOptions}");
    expect(contents).toContain("fundOptions={fundOptions}");
  });

  it("shows Needs allocation for draft expenses with zero lines", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByText("Needs allocation")).toBeTruthy();
  });

  it("keeps the New Expense flow available alongside allocation controls", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByRole("button", { name: "New Expense" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Allocate" }).length).toBeGreaterThan(
      0,
    );
  });

  it("does not expose allocation mutation controls for recorded or void expenses", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit allocation" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Allocate" }).length).toBe(2);
  });

  it("preserves existing expense summary and list content", () => {
    render(
      <ExpensesPageContent
        data={createPopulatedExpensesData()}
        vendorOptions={vendorOptions}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />,
    );

    expect(screen.getByText(/Northside Supplies · EXP-1001/)).toBeTruthy();
    expect(
      screen.getByText("Total Expenses").closest("article")?.textContent,
    ).toContain("2");
    expect(screen.getByText(/2 allocation lines/)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Needs Attention" }).closest("section")
        ?.textContent,
    ).toMatch(/Utility reimbursement draft/);
  });
});
