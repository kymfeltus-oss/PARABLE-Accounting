import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyBudgetsData,
  createPopulatedBudgetsData,
} from "@/lib/data/test/budgets-data-fixtures";

import { BudgetsPageContent } from "./budgets-page-content";

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

describe("BudgetsPageContent", () => {
  it("renders the page heading", () => {
    render(<BudgetsPageContent data={createEmptyBudgetsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Budgets" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <BudgetsPageContent data={createEmptyBudgetsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<BudgetsPageContent data={createEmptyBudgetsData()} />);

    expect(screen.getAllByText("No budgets yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No budget allocations yet.")).toBeTruthy();
  });

  it("renders live budget props", () => {
    render(<BudgetsPageContent data={createPopulatedBudgetsData()} />);

    expect(screen.getAllByText("FY 2026 Operating Budget").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Total Budgets").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Budgets With Lines").closest("article")?.textContent,
    ).toContain("1");
    expect(screen.getByText(/General Fund \$7,500\.00/)).toBeTruthy();
  });

  it("renders honest zero counts when budgets data is empty", () => {
    render(<BudgetsPageContent data={createEmptyBudgetsData()} />);

    expect(
      screen.getByText("Total Budgets").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Total Budgeted Amount").closest("article")?.textContent,
    ).toContain("$0.00");
  });

  it("states actual-to-budget comparison is unavailable", () => {
    render(<BudgetsPageContent data={createPopulatedBudgetsData()} />);

    expect(
      screen.getByText(/Actual-to-budget comparison unavailable with the current allocation model/i),
    ).toBeTruthy();
  });

  it("does not fabricate variance, percent used, or remaining budget values", () => {
    render(<BudgetsPageContent data={createPopulatedBudgetsData()} />);

    expect(screen.queryByText(/variance/i)).toBeNull();
    expect(screen.queryByText(/percent used/i)).toBeNull();
    expect(screen.queryByText(/remaining budget/i)).toBeNull();
    expect(screen.queryByText(/overspend/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<BudgetsPageContent data={createEmptyBudgetsData()} />);

    expect(
      screen.getByRole("link", { name: /Funds/i }).getAttribute("href"),
    ).toBe("/funds");
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
    expect(screen.getByRole("link", { name: /Bills/i }).getAttribute("href")).toBe(
      "/bills",
    );
    expect(
      screen.getByRole("link", { name: /Accounting/i }).getAttribute("href"),
    ).toBe("/accounting");
  });
});
