import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ExpenseRecordingStatus,
  type ExpenseRecordingStatusProps,
} from "./expense-recording-status";

function createProps(
  overrides: Partial<ExpenseRecordingStatusProps> = {},
): ExpenseRecordingStatusProps {
  return {
    recordedAt: "July 23, 2026 at 2:30 PM",
    recordedByName: "Kym Feltus",
    journalEntryNumber: "JE-2026-0042",
    ...overrides,
  };
}

afterEach(cleanup);

describe("ExpenseRecordingStatus", () => {
  it("renders the status heading", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByText("Expense recorded").tagName).toBe("H2");
  });

  it("explains that the expense is read-only", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByText("This expense is now read-only.")).toBeVisible();
  });

  it("explains that a journal entry was created", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(
      screen.getByText(
        "An accounting journal entry was created for this expense.",
      ),
    ).toBeVisible();
  });

  it("explains the correction or reversal workflow", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(
      screen.getByText(
        "Changes require a separate correction or reversal workflow.",
      ),
    ).toBeVisible();
  });

  it("renders recordedAt when provided", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByText("Recorded at")).toBeVisible();
    expect(screen.getByText("July 23, 2026 at 2:30 PM")).toBeVisible();
  });

  it("omits recordedAt when absent", () => {
    render(
      <ExpenseRecordingStatus {...createProps({ recordedAt: null })} />,
    );
    expect(screen.queryByText("Recorded at")).not.toBeInTheDocument();
  });

  it("renders recordedByName when provided", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByText("Recorded by")).toBeVisible();
    expect(screen.getByText("Kym Feltus")).toBeVisible();
  });

  it("omits recordedByName when absent", () => {
    render(
      <ExpenseRecordingStatus
        {...createProps({ recordedByName: undefined })}
      />,
    );
    expect(screen.queryByText("Recorded by")).not.toBeInTheDocument();
  });

  it("renders the journal number when provided", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByText("Journal entry")).toBeVisible();
    expect(screen.getByText("JE-2026-0042")).toBeVisible();
  });

  it("omits the journal number when absent", () => {
    render(
      <ExpenseRecordingStatus
        {...createProps({ journalEntryNumber: null })}
      />,
    );
    expect(screen.queryByText("Journal entry")).not.toBeInTheDocument();
  });

  it("does not render a fake link", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["edit", "delete", "reverse", "void", "repost"])(
    "does not render a %s control",
    (name) => {
      render(<ExpenseRecordingStatus {...createProps()} />);
      expect(
        screen.queryByRole("button", { name: new RegExp(name, "i") }),
      ).not.toBeInTheDocument();
    },
  );

  it("renders a semantic status region", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByRole("status")).toHaveAccessibleName(
      "Expense recorded",
    );
  });

  it("communicates the recorded state with readable text", () => {
    render(<ExpenseRecordingStatus {...createProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Expense recorded",
    );
    expect(screen.getByRole("status")).toHaveTextContent("read-only");
  });

  it("wraps long journal numbers safely", () => {
    render(
      <ExpenseRecordingStatus
        {...createProps({
          journalEntryNumber:
            "JE-2026-VERY-LONG-JOURNAL-ENTRY-NUMBER-THAT-MUST-WRAP-SAFELY-0042",
        })}
      />,
    );
    expect(screen.getByTestId("journal-entry-number")).toHaveClass(
      "break-words",
    );
  });

  it("contains no repository, action, or routing imports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/expenses/expense-recording-status.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
