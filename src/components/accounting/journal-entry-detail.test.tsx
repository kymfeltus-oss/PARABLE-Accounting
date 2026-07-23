import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  JournalEntryDetail,
  type JournalEntryDetailProps,
  type JournalEntryLineView,
} from "./journal-entry-detail";

const lines: JournalEntryLineView[] = [
  {
    id: "line-2",
    lineNumber: 2,
    accountCode: "2010",
    accountName: "Operating Checking",
    description: null,
    debit: 0,
    credit: 1250.5,
    fundCode: null,
    fundName: "General Fund",
  },
  {
    id: "line-1",
    lineNumber: 1,
    accountCode: "5100",
    accountName: "Community Outreach Expense",
    description: "Outreach supplies",
    debit: 1250.5,
    credit: 0,
    fundCode: "GEN",
    fundName: "General Fund",
  },
];

function createProps(
  overrides: Partial<JournalEntryDetailProps> = {},
): JournalEntryDetailProps {
  return {
    id: "journal-id-123",
    entryNumber: "JE-2026-0042",
    entryDate: "2026-07-23",
    description: "Recorded community outreach expense",
    source: "expense",
    sourceReference: "EXP-1042",
    periodName: "July 2026",
    status: "posted",
    lines,
    ...overrides,
  };
}

afterEach(cleanup);

describe("JournalEntryDetail", () => {
  it("renders the heading and entry number", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("Journal entry", { selector: "h2" })).toBeVisible();
    expect(screen.getByText("JE-2026-0042")).toBeVisible();
  });

  it("uses an empty entry-number fallback", () => {
    render(<JournalEntryDetail {...createProps({ entryNumber: " " })} />);
    expect(screen.getByText("Unnumbered entry")).toBeVisible();
  });

  it("formats valid dates deterministically", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("Jul 23, 2026")).toBeVisible();
  });

  it("renders invalid dates safely", () => {
    render(
      <JournalEntryDetail {...createProps({ entryDate: "2026-02-31" })} />,
    );
    expect(screen.getByText("Invalid date")).toBeVisible();
  });

  it("renders description and source label", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(
      screen.getByText("Recorded community outreach expense"),
    ).toBeVisible();
    expect(screen.getByText("Expense")).toBeVisible();
  });

  it("renders and omits source reference appropriately", () => {
    const { rerender } = render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("EXP-1042")).toBeVisible();
    rerender(
      <JournalEntryDetail
        {...createProps({ sourceReference: null })}
      />,
    );
    expect(screen.queryByText("Source reference")).not.toBeInTheDocument();
  });

  it("renders period and missing-period fallback", () => {
    const { rerender } = render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("July 2026")).toBeVisible();
    rerender(
      <JournalEntryDetail {...createProps({ periodName: null })} />,
    );
    expect(screen.getByText("Unassigned")).toBeVisible();
  });

  it.each([
    ["posted", "Posted"],
    ["draft", "Draft"],
    ["reversed", "Reversed"],
  ] as const)("renders readable %s status text", (status, label) => {
    render(<JournalEntryDetail {...createProps({ status })} />);
    expect(screen.getAllByText(label)).toHaveLength(2);
  });

  it("renders all journal line headers", () => {
    render(<JournalEntryDetail {...createProps()} />);
    for (const header of [
      "Line",
      "Account code",
      "Account name",
      "Description",
      "Fund",
      "Debit",
      "Credit",
    ]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  it("renders all supplied lines sorted without mutating input", () => {
    const originalOrder = lines.map((line) => line.id);
    render(<JournalEntryDetail {...createProps()} />);
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByRole("rowheader")).toHaveTextContent("1");
    expect(within(bodyRows[1]).getByRole("rowheader")).toHaveTextContent("2");
    expect(lines.map((line) => line.id)).toEqual(originalOrder);
  });

  it("renders account code and account name distinctly", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("5100")).toBeVisible();
    expect(screen.getByText("Community Outreach Expense")).toBeVisible();
  });

  it("renders supplied and absent line descriptions", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByText("Outreach supplies")).toBeVisible();
    expect(screen.getByText("—")).toBeVisible();
  });

  it.each([
    ["GEN", "General Fund", "GEN — General Fund"],
    ["GEN", null, "GEN"],
    [null, "General Fund", "General Fund"],
    [null, null, "Unassigned"],
  ] as const)(
    "formats fund code %s and name %s",
    (fundCode, fundName, expected) => {
      render(
        <JournalEntryDetail
          {...createProps({
            lines: [{ ...lines[0], fundCode, fundName }],
          })}
        />,
      );
      expect(screen.getByText(expected)).toBeVisible();
    },
  );

  it("formats line debit and credit values as tabular currency", () => {
    render(<JournalEntryDetail {...createProps()} />);
    const amounts = screen.getAllByText("$1,250.50");
    expect(amounts).toHaveLength(4);
    expect(amounts.every((amount) => amount.classList.contains("tabular-nums"))).toBe(true);
  });

  it("calculates debit and credit totals from supplied lines", () => {
    render(<JournalEntryDetail {...createProps()} />);
    const metadata = screen.getByText("Total debit").closest("dl");
    expect(metadata).not.toBeNull();
    expect(within(metadata!).getAllByText("$1,250.50")).toHaveLength(2);
  });

  it("renders balanced and out-of-balance states", () => {
    const { rerender } = render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
    rerender(
      <JournalEntryDetail
        {...createProps({
          lines: [{ ...lines[0], debit: 10, credit: 0 }],
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Out of balance");
  });

  it("uses cents-safe comparison", () => {
    render(
      <JournalEntryDetail
        {...createProps({
          lines: [
            { ...lines[0], debit: 0.1 + 0.2, credit: 0 },
            { ...lines[1], debit: 0, credit: 0.3 },
          ],
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("preserves negative values faithfully", () => {
    render(
      <JournalEntryDetail
        {...createProps({
          lines: [{ ...lines[0], debit: -5, credit: -5 }],
        })}
      />,
    );
    expect(screen.getAllByText("-$5.00")).toHaveLength(4);
  });

  it("renders an empty-line state with zero balanced totals", () => {
    render(<JournalEntryDetail {...createProps({ lines: [] })} />);
    expect(screen.getByText("No journal lines found.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
    expect(screen.getByText("Balanced")).toBeVisible();
  });

  it.each(["edit", "post", "reverse", "delete", "void", "duplicate", "repost"])(
    "does not render a %s control",
    (name) => {
      render(<JournalEntryDetail {...createProps()} />);
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${name}$`, "i") }),
      ).not.toBeInTheDocument();
    },
  );

  it("does not invent a link", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("uses semantic article, metadata, and table markup", () => {
    const { container } = render(<JournalEntryDetail {...createProps()} />);
    expect(container.querySelector("article")).toBeInTheDocument();
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toBeInTheDocument();
    expect(container.querySelector('th[scope="row"]')).toBeInTheDocument();
    expect(
      screen.getByText("Journal entry lines", { selector: "caption" }),
    ).toHaveClass("sr-only");
  });

  it("uses wrapping classes for long values", () => {
    render(
      <JournalEntryDetail
        {...createProps({
          entryNumber: "JE-VERY-LONG-ENTRY-NUMBER-THAT-MUST-WRAP",
          description: "A very long journal description that must wrap safely",
          sourceReference: "A-VERY-LONG-SOURCE-REFERENCE",
        })}
      />,
    );
    expect(screen.getByTestId("entry-number")).toHaveClass("break-words");
    expect(screen.getByText(/A very long journal description/)).toHaveClass(
      "break-words",
    );
    expect(screen.getByText("A-VERY-LONG-SOURCE-REFERENCE")).toHaveClass(
      "break-words",
    );
  });

  it("confines table scrolling to its container", () => {
    render(<JournalEntryDetail {...createProps()} />);
    expect(screen.getByTestId("journal-lines-scroll-container")).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
    );
  });

  it("contains no repository, action, or routing imports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/accounting/journal-entry-detail.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
