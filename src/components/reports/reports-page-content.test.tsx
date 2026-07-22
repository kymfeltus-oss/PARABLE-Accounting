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

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <ReportsPageContent data={createEmptyReportsData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(
      screen.getAllByText("No report-ready activity yet.").length,
    ).toBeGreaterThan(0);
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

  it("clearly marks unsupported formal statements unavailable", () => {
    render(<ReportsPageContent data={createPopulatedReportsData()} />);

    expect(
      screen.getByText(/Formal financial statements are unavailable until ledger balance aggregation/i),
    ).toBeTruthy();
    expect(screen.getByText(/Trial Balance/)).toBeTruthy();
    expect(screen.getAllByText(/Unavailable —/i).length).toBeGreaterThan(0);
  });

  it("does not fabricate balances or export functionality", () => {
    const { container } = render(
      <ReportsPageContent data={createPopulatedReportsData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/export|download|pdf|csv/i);
    expect(text).not.toMatch(/net income|retained earnings|fund balance total/i);
  });

  it("renders related workspace navigation links", () => {
    render(<ReportsPageContent data={createEmptyReportsData()} />);

    expect(screen.getByRole("link", { name: /Accounting/i })).toHaveAttribute(
      "href",
      "/accounting",
    );
    expect(screen.getByRole("link", { name: /Budgets/i })).toHaveAttribute(
      "href",
      "/budgets",
    );
    expect(screen.getByRole("link", { name: /Funds/i })).toHaveAttribute(
      "href",
      "/funds",
    );
    expect(screen.getByRole("link", { name: /Giving/i })).toHaveAttribute(
      "href",
      "/giving",
    );
  });
});
