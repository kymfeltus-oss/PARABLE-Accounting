import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyExpensesData,
  createPopulatedExpensesData,
} from "@/lib/data/test/expenses-data-fixtures";

import { ExpensesPageContent } from "./expenses-page-content";

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

afterEach(() => {
  cleanup();
});

describe("ExpensesPageContent", () => {
  it("renders the page heading", () => {
    render(<ExpensesPageContent data={createEmptyExpensesData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Expenses" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <ExpensesPageContent data={createEmptyExpensesData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<ExpensesPageContent data={createEmptyExpensesData()} />);

    expect(screen.getAllByText("No expenses yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No draft expenses.")).toBeTruthy();
  });

  it("renders live expense props", () => {
    render(<ExpensesPageContent data={createPopulatedExpensesData()} />);

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
    render(<ExpensesPageContent data={createEmptyExpensesData()} />);

    expect(
      screen.getByText("Total Expenses").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Total Amount").closest("article")?.textContent,
    ).toContain("$0.00");
  });

  it("does not render void expenses in the recent list", () => {
    render(<ExpensesPageContent data={createPopulatedExpensesData()} />);

    expect(screen.queryByText(/Voided duplicate entry/)).toBeNull();
  });

  it("renders draft expenses in the attention area", () => {
    render(<ExpensesPageContent data={createPopulatedExpensesData()} />);

    expect(
      screen.getByRole("heading", { name: "Needs Attention" }).closest("section")
        ?.textContent,
    ).toMatch(/Utility reimbursement draft/);
    expect(screen.queryByText("No draft expenses.")).toBeNull();
  });

  it("does not fabricate unsupported receipt or approval values", () => {
    render(<ExpensesPageContent data={createPopulatedExpensesData()} />);

    expect(screen.queryByText(/receipt verification/i)).toBeNull();
    expect(screen.queryByText(/approval/i)).toBeNull();
    expect(screen.queryByText(/AI classification/i)).toBeNull();
    expect(screen.queryByText(/1099/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<ExpensesPageContent data={createEmptyExpensesData()} />);

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
});
