import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyDashboardData,
  createPopulatedDashboardData,
} from "@/lib/data/test/dashboard-data-fixtures";

import { DashboardPageContent } from "./dashboard-page-content";

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

describe("DashboardPageContent", () => {
  it("renders the dashboard heading", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <DashboardPageContent data={createEmptyDashboardData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toContain("Development Preview");
    expect(text).not.toMatch(/demo|mock data|sample data|preview mode/i);
  });

  it("renders the honest production empty state", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);

    expect(screen.getByText("No financial activity yet.")).toBeTruthy();
    expect(screen.getAllByText("No items yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No close tasks yet.")).toBeTruthy();
    expect(screen.getByText("No recent activity yet.")).toBeTruthy();
  });

  it("renders live KPI values from props", () => {
    render(<DashboardPageContent data={createPopulatedDashboardData()} />);

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText("$1,250.50")).toBeTruthy();
    expect(screen.getByText("$400.00")).toBeTruthy();
    expect(screen.getByText("$850.50")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("does not render total cash as fake zero when unavailable", () => {
    const { container } = render(
      <DashboardPageContent data={createEmptyDashboardData()} />,
    );
    const kpiSection = container.textContent ?? "";

    expect(kpiSection).toContain("Unavailable");
    expect(kpiSection).not.toMatch(/Total CashUnavailable\$0\.00/);
  });

  it("renders real attention and activity records from props", () => {
    render(<DashboardPageContent data={createPopulatedDashboardData()} />);

    expect(screen.getByText("Unmatched deposit")).toBeTruthy();
    expect(screen.getByText("Form 990 filing")).toBeTruthy();
    expect(screen.getByText("BILL-100")).toBeTruthy();
    expect(screen.getByText("Bill BILL-100 created")).toBeTruthy();
  });

  it("does not fabricate AI analysis content", () => {
    const { container } = render(
      <DashboardPageContent data={createPopulatedDashboardData()} />,
    );
    const text = container.textContent ?? "";

    expect(screen.getByText("Reconcile operating account")).toBeTruthy();
    expect(text).not.toMatch(/%\s*ready/i);
    expect(text).not.toMatch(/AI summary|analysis complete|confidence score/i);
  });

  it("renders production section headings", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);

    expect(screen.getByRole("heading", { level: 2, name: "Attention" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "AI Close" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Recent Activity" }),
    ).toBeTruthy();
  });

  it("renders quick-action navigation links", () => {
    render(<DashboardPageContent data={createEmptyDashboardData()} />);

    expect(screen.getByRole("link", { name: /Giving/i }).getAttribute("href")).toBe(
      "/giving",
    );
    expect(
      screen.getByRole("link", { name: /Transactions/i }).getAttribute("href"),
    ).toBe("/transactions");
    expect(screen.getByRole("link", { name: /Bills/i }).getAttribute("href")).toBe(
      "/bills",
    );
    expect(
      screen.getByRole("link", { name: /Expenses/i }).getAttribute("href"),
    ).toBe("/expenses");
  });
});
