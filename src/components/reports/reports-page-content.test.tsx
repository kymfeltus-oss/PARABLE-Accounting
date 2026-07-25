import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyReportsData,
  createPopulatedReportsData,
} from "@/lib/data/test/reports-data-fixtures";

import { ReportsPageContent } from "./reports-page-content";

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

describe("ReportsPageContent", () => {
  it("renders the page heading", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Reports" }),
    ).toBeTruthy();
  });

  it("renders report date controls wired to the financial report dates", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    const form = screen.getByRole("form", { name: "Report date controls" });
    expect(form).toHaveAttribute("action", "/reports");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText(/As of date/i)).toHaveValue("2026-07-24");
    expect(screen.getByLabelText(/Period start/i)).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(/Period end/i)).toHaveValue("2026-07-24");
    expect(
      screen.getByRole("button", { name: "Update reports" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <ReportsPageContent data={createEmptyReportsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
    expect(container.textContent).toMatch(/posted journal lines/i);
  });

  it("renders the honest production empty state", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(
      screen.getByText(/No report-ready activity yet/i),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Record giving" })).toHaveAttribute(
      "href",
      "/giving",
    );
    expect(
      screen.getByRole("link", { name: "Record an expense" }),
    ).toHaveAttribute("href", "/expenses");
    expect(
      screen.getByRole("link", { name: "Create journal entry" }),
    ).toHaveAttribute("href", "/accounting/journals/new");
  });

  it("renders live report summaries", () => {
    render(<ReportsPageContent data={createPopulatedReportsData()} />);

    expect(
      screen.getByText("Recorded Giving").closest("article")?.textContent,
    ).toContain("$5,000.00");
    expect(screen.getByText(/Giving Summary/)).toBeTruthy();
    expect(screen.getByText(/Recorded transactions: 3/)).toBeTruthy();
    expect(screen.getByText(/Current period: July 2026/)).toBeTruthy();
  });

  it("renders honest zero snapshot values when reports data is empty", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(
      screen.getByText("Recorded Giving").closest("article")?.textContent,
    ).toContain("$0.00");
    expect(
      screen.getByText("Open Payables").closest("article")?.textContent,
    ).toContain("$0.00");
  });

  it("renders financial statement tables for available reports", () => {
    render(<ReportsPageContent data={createPopulatedReportsData()} />);

    expect(screen.getAllByText(/Trial Balance/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1000 · Operating Cash/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Net income: \$850\.00/)).toBeTruthy();
    expect(screen.getAllByText(/General Fund/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Equation balanced: Yes/i)).toBeTruthy();
  });

  it("marks only cash flow unavailable", () => {
    render(<ReportsPageContent data={createPopulatedReportsData()} />);

    expect(screen.getByText(/Cash Flow Statement/)).toBeTruthy();
    expect(screen.getByText(/Budget vs Actual/)).toBeTruthy();
    expect(screen.queryByText(/Budget vs Actual.*Unavailable/i)).toBeNull();
    expect(screen.queryByText(/Trial Balance.*Unavailable/i)).toBeNull();
  });

  it("does not fabricate export functionality", () => {
    const { container } = render(
      <ReportsPageContent data={createPopulatedReportsData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/export|download|pdf|csv/i);
  });

  it("renders related workspace navigation links", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(
      screen.getByRole("link", { name: /Accounting.*Review ledger/i }),
    ).toHaveAttribute("href", "/accounting");
    expect(
      screen.getByRole("link", { name: /Budgets.*Inspect budget/i }),
    ).toHaveAttribute("href", "/budgets");
    expect(
      screen.getByRole("link", { name: /Funds.*Review designated/i }),
    ).toHaveAttribute("href", "/funds");
    expect(
      screen.getByRole("link", { name: /Giving.*Open recorded/i }),
    ).toHaveAttribute("href", "/giving");
  });
});
