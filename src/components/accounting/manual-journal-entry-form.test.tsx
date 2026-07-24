import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ManualJournalEntryForm,
  type ManualJournalEntryFormProps,
  type ManualJournalSubmitResult,
} from "./manual-journal-entry-form";

const accounts = [
  { id: "expense-account", code: "5100", name: "Office Expense" },
  { id: "cash-account", code: "1010", name: "Operating Checking" },
];
const funds = [{ id: "general-fund", code: "GEN", name: "General Fund" }];
const periods = [
  {
    id: "open-period",
    name: "July 2026",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    isOpen: true,
  },
  {
    id: "closed-period",
    name: "June 2026",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    isOpen: false,
  },
];
const successResult: ManualJournalSubmitResult = {
  success: true,
  journalEntryId: "journal-123",
  entryNumber: "JE-2026-0042",
};

function createProps(
  overrides: Partial<ManualJournalEntryFormProps> = {},
): ManualJournalEntryFormProps {
  return {
    accounts,
    funds,
    periods,
    onSubmit: vi.fn().mockResolvedValue(successResult),
    ...overrides,
  };
}

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Entry date"), "2026-07-23");
  const accountInputs = screen.getAllByLabelText("Account");
  await user.selectOptions(accountInputs[0], "expense-account");
  await user.selectOptions(accountInputs[1], "cash-account");
  await user.type(screen.getAllByLabelText("Debit")[0], "125.50");
  await user.type(screen.getAllByLabelText("Credit")[1], "125.50");
  return user;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ManualJournalEntryForm", () => {
  it("renders the heading and header fields", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(
      screen.getByText("Create manual journal entry", { selector: "h2" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Entry date")).toBeVisible();
    expect(screen.getByLabelText("Accounting period")).toBeVisible();
    expect(screen.getByLabelText("Description")).toBeVisible();
  });

  it("starts with two complete journal lines", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getAllByRole("group", { name: /Journal line/ })).toHaveLength(2);
    expect(screen.getAllByLabelText("Account")).toHaveLength(2);
    expect(screen.getAllByLabelText("Fund")).toHaveLength(2);
    expect(screen.getAllByLabelText("Debit")).toHaveLength(2);
    expect(screen.getAllByLabelText("Credit")).toHaveLength(2);
  });

  it("adds and removes a line above the two-line minimum", async () => {
    const user = userEvent.setup();
    render(<ManualJournalEntryForm {...createProps()} />);
    await user.click(screen.getByRole("button", { name: "Add journal line" }));
    expect(screen.getAllByRole("group", { name: /Journal line/ })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Remove journal line 3" }));
    expect(screen.getAllByRole("group", { name: /Journal line/ })).toHaveLength(2);
  });

  it("does not allow removing below two lines", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(
      screen.getByRole("button", { name: "Remove journal line 1" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Remove journal line 2" }),
    ).toBeDisabled();
  });

  it("requires an account and a positive one-sided amount", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getAllByText("Account is required.")).toHaveLength(2);
    expect(
      screen.getAllByText("Enter a positive debit or credit amount."),
    ).toHaveLength(2);
  });

  it("rejects debit and credit on the same line", async () => {
    const user = userEvent.setup();
    render(<ManualJournalEntryForm {...createProps()} />);
    await user.type(screen.getAllByLabelText("Debit")[0], "10");
    await user.type(screen.getAllByLabelText("Credit")[0], "10");
    expect(
      screen.getByText("A line cannot contain both a debit and a credit."),
    ).toBeVisible();
  });

  it.each(["-10", "not-a-number"])(
    "rejects invalid amount %s",
    async (amount) => {
      const user = userEvent.setup();
      render(<ManualJournalEntryForm {...createProps()} />);
      await user.type(screen.getAllByLabelText("Debit")[0], amount);
      expect(
        screen.getByText(
          "Enter valid nonnegative debit and credit amounts.",
        ),
      ).toBeVisible();
    },
  );

  it("treats empty amounts as zero", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getAllByText("$0.00")).toHaveLength(2);
  });

  it("calculates debit and credit totals using cents-safe balancing", async () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    const user = userEvent.setup();
    await user.type(screen.getAllByLabelText("Debit")[0], "0.10");
    await user.type(screen.getAllByLabelText("Debit")[1], "0.20");
    await user.type(screen.getAllByLabelText("Credit")[0], "0.30");
    expect(screen.getAllByText("$0.30", { selector: "dd" })).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Balanced");
  });

  it("renders out-of-balance status and blocks zero journals", async () => {
    const user = userEvent.setup();
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Out of balance");
    expect(
      screen.getByRole("button", { name: "Create journal entry" }),
    ).toBeDisabled();
    await user.type(screen.getAllByLabelText("Debit")[0], "10");
    expect(screen.getByRole("status")).toHaveTextContent("Out of balance");
  });

  it("blocks invalid and unbalanced lines", async () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Entry date"), "2026-07-23");
    await user.selectOptions(screen.getAllByLabelText("Account")[0], "expense-account");
    await user.type(screen.getAllByLabelText("Debit")[0], "10");
    expect(
      screen.getByRole("button", { name: "Create journal entry" }),
    ).toBeDisabled();
  });

  it("enables submission for a valid balanced journal", async () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    await fillValidForm();
    expect(
      screen.getByRole("button", { name: "Create journal entry" }),
    ).toBeEnabled();
  });

  it("shows only open period options", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getByRole("option", { name: "July 2026" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "June 2026" }),
    ).not.toBeInTheDocument();
  });

  it("blocks when no open period exists", () => {
    render(
      <ManualJournalEntryForm
        {...createProps({
          periods: periods.map((period) => ({ ...period, isOpen: false })),
        })}
      />,
    );
    expect(
      screen.getByText("No open accounting periods are available."),
    ).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Entry date")).toBeDisabled();
  });

  it("blocks when no accounts exist", () => {
    render(<ManualJournalEntryForm {...createProps({ accounts: [] })} />);
    expect(
      screen.getByText(
        "No accounts are available for a manual journal entry.",
      ),
    ).toHaveAttribute("role", "status");
  });

  it("formats account and fund option labels", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(
      screen.getAllByRole("option", { name: "5100 — Office Expense" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("option", { name: "GEN — General Fund" }),
    ).toHaveLength(2);
  });

  it("submits the exact normalized payload without client ids", async () => {
    const onSubmit = vi.fn().mockResolvedValue(successResult);
    render(<ManualJournalEntryForm {...createProps({ onSubmit })} />);
    const user = await fillValidForm();
    await user.type(screen.getByLabelText("Description"), "  Monthly close  ");
    await user.type(screen.getAllByLabelText("Line description")[0], "  Supplies  ");
    await user.selectOptions(screen.getAllByLabelText("Fund")[0], "general-fund");
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));

    expect(onSubmit).toHaveBeenCalledWith({
      entryDate: "2026-07-23",
      description: "Monthly close",
      periodId: "open-period",
      lines: [
        {
          accountId: "expense-account",
          description: "Supplies",
          debit: 125.5,
          credit: 0,
          fundId: "general-fund",
        },
        {
          accountId: "cash-account",
          description: null,
          debit: 0,
          credit: 125.5,
          fundId: null,
        },
      ],
    });
    expect(JSON.stringify(onSubmit.mock.calls[0][0])).not.toContain("clientId");
  });

  it("prevents duplicate submission while pending and announces it", async () => {
    let resolveSubmit:
      | ((result: ManualJournalSubmitResult) => void)
      | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<ManualJournalSubmitResult>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<ManualJournalEntryForm {...createProps({ onSubmit })} />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByText("Creating journal entry…")).toHaveAttribute(
      "role",
      "status",
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.(successResult);
    await screen.findByText("Manual journal entry created");
  });

  it("preserves values and renders field/general errors after failure", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      message: "The journal entry could not be created.",
      fieldErrors: { "lines.0.accountId": "Review this account." },
    } satisfies ManualJournalSubmitResult);
    render(<ManualJournalEntryForm {...createProps({ onSubmit })} />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));
    expect(await screen.findByText("Review this account.")).toBeVisible();
    expect(
      screen.getByText("The journal entry could not be created."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getAllByLabelText("Debit")[0]).toHaveValue("125.50");
  });

  it("shows success and calls onCreated", async () => {
    const onCreated = vi.fn();
    render(<ManualJournalEntryForm {...createProps({ onCreated })} />);
    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));
    expect(await screen.findByText(/JE-2026-0042/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Manual journal entry created",
    );
    expect(onCreated).toHaveBeenCalledWith({
      journalEntryId: "journal-123",
      entryNumber: "JE-2026-0042",
    });
  });

  it("has accessible field and line-control labels", () => {
    render(<ManualJournalEntryForm {...createProps()} />);
    expect(screen.getByLabelText("Entry date")).toBeVisible();
    expect(screen.getAllByLabelText("Account")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Remove journal line 1" }),
    ).toBeVisible();
  });

  it.each(["post", "reverse", "delete", "void", "duplicate"])(
    "does not render a %s control",
    (name) => {
      render(<ManualJournalEntryForm {...createProps()} />);
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${name}$`, "i") }),
      ).not.toBeInTheDocument();
    },
  );

  it("uses responsive, page-overflow-safe containers", () => {
    const { container } = render(
      <ManualJournalEntryForm {...createProps()} />,
    );
    expect(container.querySelector("section")).toHaveClass("max-w-full");
    expect(
      screen.getByRole("group", { name: "Journal line 1" }),
    ).toHaveClass("min-w-0");
  });

  it("contains no repository, concrete action, or routing imports", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/accounting/manual-journal-entry-form.tsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*(repository|actions?)/i);
    expect(source).not.toMatch(/from\s+["']next\/(link|navigation|router)/i);
  });
});
