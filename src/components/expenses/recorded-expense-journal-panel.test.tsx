import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  RecordedExpenseJournalPanel,
  type RecordedExpenseJournalPanelProps,
} from "./recorded-expense-journal-panel";

function createProps(
  overrides: Partial<RecordedExpenseJournalPanelProps> = {},
): RecordedExpenseJournalPanelProps {
  return {
    journalEntryId: "journal-id-123",
    entryNumber: "JE-2026-0042",
    entryDate: "July 23, 2026",
    status: "posted",
    totalDebit: 1250.5,
    totalCredit: 1250.5,
    periodName: "July 2026",
    sourceReference: "EXP-1042",
    href: "/accounting/journal/JE-2026-0042",
    ...overrides,
  };
}

afterEach(cleanup);

describe("RecordedExpenseJournalPanel", () => {
  it("renders the heading", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByText("Journal Entry").tagName).toBe("H2");
  });

  it("renders the entry number", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByText("JE-2026-0042")).toBeVisible();
  });

  it("renders the entry date", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByText("July 23, 2026")).toBeVisible();
  });

  it.each([
    ["posted", "Posted"],
    ["draft", "Draft"],
    ["reversed", "Reversed"],
    ["void", "VOID"],
  ] as const)("renders readable %s status text", (status, label) => {
    render(<RecordedExpenseJournalPanel {...createProps({ status })} />);
    expect(screen.getAllByText(label)).toHaveLength(2);
  });

  it("renders formatted debit and credit amounts with tabular numerals", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    const amounts = screen.getAllByText("$1,250.50");
    expect(amounts).toHaveLength(2);
    expect(amounts[0]).toHaveClass("tabular-nums");
    expect(amounts[1]).toHaveClass("tabular-nums");
  });

  it("renders Balanced when totals match", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("renders Out of balance when totals differ", () => {
    render(
      <RecordedExpenseJournalPanel
        {...createProps({ totalCredit: 1249.5 })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Out of balance");
  });

  it("compares currency safely to two decimal places", () => {
    render(
      <RecordedExpenseJournalPanel
        {...createProps({
          totalDebit: 0.1 + 0.2,
          totalCredit: 0.3,
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("renders the accounting period when provided", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByText("Accounting period")).toBeVisible();
    expect(screen.getByText("July 2026")).toBeVisible();
  });

  it("omits the accounting period when absent", () => {
    render(
      <RecordedExpenseJournalPanel {...createProps({ periodName: null })} />,
    );
    expect(screen.queryByText("Accounting period")).not.toBeInTheDocument();
  });

  it("renders the source reference when provided", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(screen.getByText("Source reference")).toBeVisible();
    expect(screen.getByText("EXP-1042")).toBeVisible();
  });

  it("omits the source reference when absent", () => {
    render(
      <RecordedExpenseJournalPanel
        {...createProps({ sourceReference: "" })}
      />,
    );
    expect(screen.queryByText("Source reference")).not.toBeInTheDocument();
  });

  it("renders a journal link using the exact provided href", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    expect(
      screen.getByRole("link", { name: "View journal entry" }),
    ).toHaveAttribute("href", "/accounting/journal/JE-2026-0042");
  });

  it("omits the journal link when href is absent", () => {
    render(<RecordedExpenseJournalPanel {...createProps({ href: null })} />);
    expect(
      screen.queryByRole("link", { name: "View journal entry" }),
    ).not.toBeInTheDocument();
  });

  it("renders zero debit and credit as a balanced journal", () => {
    render(
      <RecordedExpenseJournalPanel
        {...createProps({ totalDebit: 0, totalCredit: 0 })}
      />,
    );
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("keeps a long entry number in a wrapping container", () => {
    render(
      <RecordedExpenseJournalPanel
        {...createProps({
          entryNumber:
            "JE-2026-VERY-LONG-ENTRY-NUMBER-THAT-MUST-WRAP-SAFELY-0042",
        })}
      />,
    );
    expect(screen.getByTestId("journal-entry-number")).toHaveClass(
      "break-words",
    );
  });

  it("uses the internal id only when the entry number is unavailable", () => {
    render(
      <RecordedExpenseJournalPanel {...createProps({ entryNumber: " " })} />,
    );
    expect(screen.getByText("journal-id-123")).toBeVisible();
  });

  it("does not render destructive or editing controls", () => {
    render(<RecordedExpenseJournalPanel {...createProps()} />);
    for (const name of ["edit", "reverse", "void", "delete", "repost"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(name, "i") }),
      ).not.toBeInTheDocument();
    }
  });

  it("contains no repository, action, or routing imports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/expenses/recorded-expense-journal-panel.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
