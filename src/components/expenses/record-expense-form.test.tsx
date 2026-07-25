import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RecordExpenseForm,
  type RecordExpenseFormProps,
  type RecordExpenseResult,
} from "./record-expense-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const creditAccounts: RecordExpenseFormProps["creditAccounts"] = [
  {
    id: "account-cash",
    code: "1010",
    name: "Operating Checking",
    accountType: "asset",
  },
  {
    id: "account-card",
    code: "2010",
    name: "Ministry Credit Card",
    accountType: "liability",
  },
];

const successfulResult: RecordExpenseResult = {
  success: true,
  expenseId: "expense-123",
  status: "recorded",
  journalEntryId: "journal-456",
};

function createProps(
  overrides: Partial<RecordExpenseFormProps> = {},
): RecordExpenseFormProps {
  return {
    expenseId: "expense-123",
    expenseDescription: "Community outreach supplies",
    expenseAmount: 1250.5,
    paymentSource: "Ministry card ending in 4242",
    allocationComplete: true,
    creditAccounts,
    onRecord: vi.fn().mockResolvedValue(successfulResult),
    ...overrides,
  };
}

async function selectAccountAndOpenConfirmation() {
  const user = userEvent.setup();
  await user.selectOptions(
    screen.getByLabelText("Payment / credit account"),
    "account-cash",
  );
  await user.click(screen.getByRole("button", { name: "Review and record" }));
  return user;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecordExpenseForm", () => {
  it("prefills the payment account from the org default when eligible", () => {
    render(
      <RecordExpenseForm
        {...createProps({ defaultCreditAccountId: "account-cash" })}
      />,
    );

    expect(
      screen.getByLabelText("Payment / credit account"),
    ).toHaveValue("account-cash");
  });

  it("renders the expense details", () => {
    render(<RecordExpenseForm {...createProps()} />);

    expect(
      screen.getByText("Community outreach supplies"),
    ).toBeInTheDocument();
    expect(screen.getByText("$1,250.50")).toHaveClass("tabular-nums");
    expect(
      screen.getByText("Ministry card ending in 4242"),
    ).toBeInTheDocument();
  });

  it("renders every eligible account", () => {
    render(<RecordExpenseForm {...createProps()} />);

    expect(
      screen.getByRole("option", { name: "1010 — Operating Checking" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "2010 — Ministry Credit Card" }),
    ).toBeInTheDocument();
  });

  it("disables submission when allocation is incomplete", () => {
    render(
      <RecordExpenseForm
        {...createProps({ allocationComplete: false })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Review and record" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Complete the expense allocation before recording."),
    ).toHaveAttribute("role", "status");
  });

  it("disables submission without a selected account", () => {
    render(<RecordExpenseForm {...createProps()} />);

    expect(
      screen.getByRole("button", { name: "Review and record" }),
    ).toBeDisabled();
  });

  it("renders a clear non-interactive empty-account state", () => {
    render(
      <RecordExpenseForm {...createProps({ creditAccounts: [] })} />,
    );

    expect(
      screen.getByText("No eligible payment accounts are available."),
    ).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Payment / credit account")).toBeDisabled();
  });

  it("enables confirmation after an account is selected", async () => {
    const user = userEvent.setup();
    render(<RecordExpenseForm {...createProps()} />);

    await user.selectOptions(
      screen.getByLabelText("Payment / credit account"),
      "account-cash",
    );

    expect(
      screen.getByRole("button", { name: "Review and record" }),
    ).toBeEnabled();
  });

  it("opens confirmation identifying the amount and selected account", async () => {
    render(<RecordExpenseForm {...createProps()} />);
    await selectAccountAndOpenConfirmation();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Confirm expense recording");
    expect(dialog).toHaveTextContent("$1,250.50");
    expect(dialog).toHaveTextContent("1010 — Operating Checking");
  });

  it("cancels confirmation without losing the selected account", async () => {
    render(<RecordExpenseForm {...createProps()} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Payment / credit account")).toHaveValue(
      "account-cash",
    );
  });

  it("passes the exact expense and account ids to onRecord", async () => {
    const onRecord = vi.fn().mockResolvedValue(successfulResult);
    render(<RecordExpenseForm {...createProps({ onRecord })} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(onRecord).toHaveBeenCalledWith({
      expenseId: "expense-123",
      creditAccountId: "account-cash",
    });
  });

  it("prevents duplicate submission while recording is pending", async () => {
    let resolveRecord: ((result: RecordExpenseResult) => void) | undefined;
    const onRecord = vi.fn(
      () =>
        new Promise<RecordExpenseResult>((resolve) => {
          resolveRecord = resolve;
        }),
    );
    render(<RecordExpenseForm {...createProps({ onRecord })} />);
    const user = await selectAccountAndOpenConfirmation();

    const recordButton = screen.getByRole("button", {
      name: "Record expense",
    });
    await user.click(recordButton);

    expect(
      screen.getByRole("button", { name: "Recording…" }),
    ).toBeDisabled();
    expect(onRecord).toHaveBeenCalledTimes(1);
    resolveRecord?.(successfulResult);
    await screen.findByText("Expense recorded");
  });

  it("preserves the selected account when submission fails", async () => {
    const onRecord = vi.fn().mockResolvedValue({
      success: false,
      message: "The expense could not be recorded.",
    } satisfies RecordExpenseResult);
    render(<RecordExpenseForm {...createProps({ onRecord })} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));
    await screen.findByText("The expense could not be recorded.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Payment / credit account")).toHaveValue(
      "account-cash",
    );
  });

  it("renders a field-level account error", async () => {
    const onRecord = vi.fn().mockResolvedValue({
      success: false,
      fieldErrors: {
        creditAccountId: "That payment account is no longer eligible.",
      },
      message: "Review the highlighted field.",
    } satisfies RecordExpenseResult);
    render(<RecordExpenseForm {...createProps({ onRecord })} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(
      await screen.findByText("That payment account is no longer eligible."),
    ).toHaveAttribute("role", "alert");
  });

  it("renders a general action error", async () => {
    const onRecord = vi.fn().mockResolvedValue({
      success: false,
      message: "This expense could not be recorded right now.",
    } satisfies RecordExpenseResult);
    render(<RecordExpenseForm {...createProps({ onRecord })} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(
      await screen.findByText("This expense could not be recorded right now."),
    ).toHaveAttribute("role", "alert");
  });

  it("shows a success state after recording", async () => {
    render(<RecordExpenseForm {...createProps()} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(await screen.findByText("Expense recorded")).toBeInTheDocument();
    expect(
      screen.getByText(/was recorded successfully/i),
    ).toHaveAttribute("role", "status");
  });

  it("calls onRecorded after a successful recording", async () => {
    const onRecorded = vi.fn();
    render(<RecordExpenseForm {...createProps({ onRecorded })} />);
    const user = await selectAccountAndOpenConfirmation();

    await user.click(screen.getByRole("button", { name: "Record expense" }));

    await waitFor(() =>
      expect(onRecorded).toHaveBeenCalledWith({
        expenseId: "expense-123",
        journalEntryId: "journal-456",
      }),
    );
  });

  it("provides accessible labels for interactive controls", () => {
    render(<RecordExpenseForm {...createProps()} />);

    expect(
      screen.getByRole("combobox", { name: "Payment / credit account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review and record" }),
    ).toBeInTheDocument();
  });

  it("makes explanatory state programmatically readable", () => {
    render(<RecordExpenseForm {...createProps()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Recording creates the accounting entry",
    );
  });

  it("reuses the approved Button and Sheet components", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "src/components/expenses/record-expense-form.tsx",
      ),
      "utf8",
    );

    expect(source).toContain('from "@/components/ui/button"');
    expect(source).toContain('from "@/components/ui/sheet"');
    expect(source).not.toMatch(/server|supabase|repository/i);
  });
});
