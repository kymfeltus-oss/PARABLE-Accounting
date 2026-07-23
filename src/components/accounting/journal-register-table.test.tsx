import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  JournalRegisterTable,
  type JournalRegisterFilters,
  type JournalRegisterRow,
} from "./journal-register-table";

const filters: JournalRegisterFilters = {
  search: "",
  status: "all",
  source: "all",
};

const row: JournalRegisterRow = {
  id: "journal-id-123",
  entryNumber: "JE-2026-0042",
  entryDate: "2026-07-23",
  description: "Recorded community outreach expense",
  source: "expense",
  sourceReference: "EXP-1042",
  periodName: "July 2026",
  status: "posted",
  totalDebit: 1250.5,
  totalCredit: 1250.5,
};

function renderTable(
  overrides: Partial<React.ComponentProps<typeof JournalRegisterTable>> = {},
) {
  const props: React.ComponentProps<typeof JournalRegisterTable> = {
    rows: [row],
    filters,
    onFiltersChange: vi.fn(),
    ...overrides,
  };
  render(<JournalRegisterTable {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("JournalRegisterTable", () => {
  it("renders an accessible journal register label", () => {
    renderTable();
    expect(screen.getByText("Journal register", { selector: "h2" })).toBeVisible();
    expect(screen.getByText("Journal register", { selector: "caption" })).toHaveClass("sr-only");
  });

  it("renders all table headers", () => {
    renderTable({ onViewEntry: vi.fn() });
    for (const header of [
      "Entry number",
      "Entry date",
      "Description",
      "Source",
      "Accounting period",
      "Status",
      "Total debit",
      "Total credit",
      "Balance state",
      "Action",
    ]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeVisible();
    }
  });

  it("renders an entry number and safe fallback", () => {
    const { rerender } = render(
      <JournalRegisterTable rows={[row]} filters={filters} onFiltersChange={vi.fn()} />,
    );
    expect(screen.getByText("JE-2026-0042")).toBeVisible();
    rerender(
      <JournalRegisterTable
        rows={[{ ...row, entryNumber: " " }]}
        filters={filters}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Unnumbered entry")).toBeVisible();
  });

  it("formats valid dates deterministically", () => {
    renderTable();
    expect(screen.getByText("Jul 23, 2026")).toBeVisible();
  });

  it("renders invalid dates safely", () => {
    renderTable({ rows: [{ ...row, entryDate: "2026-02-31" }] });
    expect(screen.getByText("Invalid date")).toBeVisible();
  });

  it("renders description and optional source reference", () => {
    renderTable();
    expect(screen.getByText(row.description)).toBeVisible();
    expect(screen.getByText("EXP-1042")).toBeVisible();
  });

  it("omits source reference when absent", () => {
    renderTable({ rows: [{ ...row, sourceReference: null }] });
    expect(screen.queryByText("EXP-1042")).not.toBeInTheDocument();
  });

  it.each([
    ["expense", "Expense"],
    ["giving", "Giving"],
    ["manual", "Manual"],
    ["banking", "Banking"],
    ["opening_balance", "Opening balance"],
    ["other", "Other"],
  ] as const)("formats %s as %s", (source, label) => {
    renderTable({ rows: [{ ...row, source }] });
    expect(screen.getByRole("cell", { name: label })).toBeVisible();
  });

  it("renders a period and missing-period fallback", () => {
    const { rerender } = render(
      <JournalRegisterTable rows={[row]} filters={filters} onFiltersChange={vi.fn()} />,
    );
    expect(screen.getByText("July 2026")).toBeVisible();
    rerender(
      <JournalRegisterTable
        rows={[{ ...row, periodName: null }]}
        filters={filters}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Unassigned")).toBeVisible();
  });

  it.each([
    ["posted", "Posted"],
    ["draft", "Draft"],
    ["reversed", "Reversed"],
  ] as const)("renders readable %s status text", (status, label) => {
    renderTable({ rows: [{ ...row, status }] });
    expect(screen.getByRole("cell", { name: label })).toBeVisible();
  });

  it("formats debit and credit as tabular currency", () => {
    renderTable();
    const amounts = screen.getAllByText("$1,250.50");
    expect(amounts).toHaveLength(2);
    expect(amounts[0]).toHaveClass("tabular-nums");
    expect(amounts[1]).toHaveClass("tabular-nums");
  });

  it("displays negative amounts faithfully", () => {
    renderTable({ rows: [{ ...row, totalDebit: -5, totalCredit: -5 }] });
    expect(screen.getAllByText("-$5.00")).toHaveLength(2);
  });

  it("renders balanced and out-of-balance states", () => {
    const { rerender } = render(
      <JournalRegisterTable rows={[row]} filters={filters} onFiltersChange={vi.fn()} />,
    );
    expect(screen.getByText("Balanced")).toBeVisible();
    rerender(
      <JournalRegisterTable
        rows={[{ ...row, totalCredit: 1200 }]}
        filters={filters}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Out of balance")).toBeVisible();
  });

  it("uses cents-safe comparison", () => {
    renderTable({
      rows: [{ ...row, totalDebit: 0.1 + 0.2, totalCredit: 0.3 }],
    });
    expect(screen.getByText("Balanced")).toBeVisible();
  });

  it("handles zero-value balanced journals", () => {
    renderTable({ rows: [{ ...row, totalDebit: 0, totalCredit: 0 }] });
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
    expect(screen.getByText("Balanced")).toBeVisible();
  });

  it("labels search, status, and source controls", () => {
    renderTable();
    expect(screen.getByRole("searchbox", { name: "Search journal entries" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Source" })).toBeVisible();
  });

  it("sends exact controlled search updates", async () => {
    const onFiltersChange = vi.fn();
    renderTable({ onFiltersChange });
    await userEvent.setup().type(
      screen.getByRole("searchbox", { name: "Search journal entries" }),
      "J",
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, search: "J" });
  });

  it("updates status while preserving other filters", async () => {
    const onFiltersChange = vi.fn();
    const current = { search: "July", status: "all", source: "expense" } as const;
    renderTable({ filters: current, onFiltersChange });
    await userEvent.setup().selectOptions(
      screen.getByRole("combobox", { name: "Status" }),
      "posted",
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ ...current, status: "posted" });
  });

  it("updates source while preserving other filters", async () => {
    const onFiltersChange = vi.fn();
    const current = { search: "July", status: "draft", source: "all" } as const;
    renderTable({ filters: current, onFiltersChange });
    await userEvent.setup().selectOptions(
      screen.getByRole("combobox", { name: "Source" }),
      "manual",
    );
    expect(onFiltersChange).toHaveBeenCalledWith({ ...current, source: "manual" });
  });

  it("renders accessible empty and loading states", () => {
    const { rerender } = render(
      <JournalRegisterTable rows={[]} filters={filters} onFiltersChange={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No journal entries found.");
    rerender(
      <JournalRegisterTable
        rows={[]}
        filters={filters}
        isLoading
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading journal entries");
  });

  it("renders View and passes the exact journal id", async () => {
    const onViewEntry = vi.fn();
    renderTable({ onViewEntry });
    await userEvent.setup().click(screen.getByRole("button", { name: "View" }));
    expect(onViewEntry).toHaveBeenCalledWith("journal-id-123");
  });

  it("omits View when no callback exists", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });

  it.each(["edit", "post", "reverse", "delete", "void", "duplicate"])(
    "does not render a %s control",
    (name) => {
      renderTable();
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${name}$`, "i") }),
      ).not.toBeInTheDocument();
    },
  );

  it("uses overflow-safe classes for long content", () => {
    renderTable({
      rows: [{
        ...row,
        entryNumber: "JE-VERY-LONG-NUMBER-THAT-MUST-WRAP",
        description: "A very long journal description that must wrap safely",
      }],
    });
    expect(screen.getByText("JE-VERY-LONG-NUMBER-THAT-MUST-WRAP")).toHaveClass("break-words");
    expect(screen.getByText(/A very long journal description/)).toHaveClass("break-words");
  });

  it("confines horizontal scrolling to the table container", () => {
    renderTable();
    expect(screen.getByTestId("journal-table-scroll-container")).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
    );
  });

  it("uses semantic table structure", () => {
    const { container } = render(
      <JournalRegisterTable rows={[row]} filters={filters} onFiltersChange={vi.fn()} />,
    );
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toBeInTheDocument();
    expect(container.querySelector('th[scope="row"]')).toBeInTheDocument();
  });

  it("contains no repository, action, or routing imports", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/accounting/journal-register-table.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
