import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyBankingData,
  createPopulatedBankingData,
} from "@/lib/data/test/banking-data-fixtures";

import { BankingPageContent } from "./banking-page-content";

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

describe("BankingPageContent", () => {
  it("renders the page heading", () => {
    render(<BankingPageContent data={createEmptyBankingData()} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Banking" }),
    ).toBeTruthy();
  });

  it("does not render Development Preview or demo labels", () => {
    const { container } = render(
      <BankingPageContent data={createEmptyBankingData()} />,
    );

    expect(container.textContent).not.toContain("Development Preview");
    expect(container.textContent).not.toMatch(/demo|mock data|sample data/i);
  });

  it("renders the honest production empty state", () => {
    render(<BankingPageContent data={createEmptyBankingData()} />);

    expect(
      screen.getByText("No bank accounts or transactions yet."),
    ).toBeTruthy();
  });

  it("renders live banking props", () => {
    render(<BankingPageContent data={createPopulatedBankingData()} />);

    expect(screen.getAllByText("Operating Account").length).toBeGreaterThan(0);
    expect(screen.getByText(/Deposit from offering/)).toBeTruthy();
    expect(
      screen.getByText("Connected Accounts").closest("article")?.textContent,
    ).toContain("1");
    expect(
      screen.getByText("Unmatched Transactions").closest("article")?.textContent,
    ).toContain("1");
    expect(screen.getByText("Balance unavailable")).toBeTruthy();
  });

  it("renders honest zero counts when banking data is empty", () => {
    render(<BankingPageContent data={createEmptyBankingData()} />);

    expect(
      screen.getByText("Connected Accounts").closest("article")?.textContent,
    ).toContain("0");
    expect(
      screen.getByText("Unmatched Transactions").closest("article")?.textContent,
    ).toContain("0");
  });

  it("does not fabricate unsupported banking metrics", () => {
    render(<BankingPageContent data={createPopulatedBankingData()} />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByText(/%\s*reconciled/i)).toBeNull();
  });

  it("renders related workspace navigation links", () => {
    render(<BankingPageContent data={createEmptyBankingData()} />);

    expect(
      screen.getByRole("link", { name: /Transactions/i }).getAttribute("href"),
    ).toBe("/transactions");
    expect(
      screen.getByRole("link", { name: /Accounting/i }).getAttribute("href"),
    ).toBe("/accounting");
    expect(screen.getByRole("link", { name: /Reports/i }).getAttribute("href")).toBe(
      "/reports",
    );
  });
});
