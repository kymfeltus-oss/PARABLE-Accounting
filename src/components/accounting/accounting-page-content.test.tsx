import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAccountingData,
  createPopulatedAccountingData,
} from "@/lib/data/test/accounting-data-fixtures";

import { AccountingPageContent } from "./accounting-page-content";

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

describe("AccountingPageContent", () => {
  it("renders the page heading", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Accounting" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <AccountingPageContent data={createEmptyAccountingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getAllByText("No accounting records yet.").length).toBeGreaterThan(0);
    expect(screen.getByText("No accounts yet.")).toBeTruthy();
    expect(screen.getByText("No accounting periods yet.")).toBeTruthy();
    expect(screen.getByText("No journal entries yet.")).toBeTruthy();
  });

  it("renders live accounting props", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(screen.getByText(/1000 · Operating Cash/)).toBeTruthy();
    expect(screen.getByText(/JE-1001/)).toBeTruthy();
    expect(screen.getByText("July 2026")).toBeTruthy();
    expect(
      screen.getByText("Total Accounts").closest("article")?.textContent,
    ).toContain("2");
    expect(
      screen.getByText("Posted Journal Entries").closest("article")?.textContent,
    ).toContain("1");
  });

  it("renders honest zero counts when accounting data is empty", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(
      screen.getByText("Total Accounts").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Draft Journal Entries").closest("article")?.textContent,
    ).toContain("0");
  });

  it("states account balances and trial balance are unavailable", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(
      screen.getByText(/Account balances and trial balance are unavailable until ledger balance aggregation is implemented/i),
    ).toBeTruthy();
  });

  it("does not fabricate account balance or trial balance totals", () => {
    const { container } = render(
      <AccountingPageContent data={createPopulatedAccountingData()} />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/retained earnings/i);
    expect(text).not.toMatch(/net income/i);
    expect(text).not.toMatch(/trial balance total/i);
    expect(text).not.toMatch(/account balance:/i);
  });

  it("renders unbalanced journal entries honestly", () => {
    render(<AccountingPageContent data={createPopulatedAccountingData()} />);

    expect(screen.getByText(/Unbalanced/)).toBeTruthy();
    expect(screen.getByText(/Debits \$200\.00 · Credits \$100\.00/)).toBeTruthy();
  });

  it("renders related workspace navigation links", () => {
    render(<AccountingPageContent data={createEmptyAccountingData()} />);

    expect(screen.getByRole("link", { name: /Transactions/i })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: /Funds/i })).toHaveAttribute(
      "href",
      "/funds",
    );
    expect(screen.getByRole("link", { name: /Budgets/i })).toHaveAttribute(
      "href",
      "/budgets",
    );
    expect(screen.getByRole("link", { name: /Reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
  });
});
