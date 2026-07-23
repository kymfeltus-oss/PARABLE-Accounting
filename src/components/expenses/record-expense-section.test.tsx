import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExpenseCreditAccountOption } from "@/lib/data/expense-credit-account-options";

import { RecordExpenseSection } from "./record-expense-section";

const refreshMock = vi.fn();

const { recordExpenseActionMock } = vi.hoisted(() => ({
  recordExpenseActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/app/(workspace)/expenses/actions", () => ({
  recordExpenseAction: recordExpenseActionMock,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const creditAccountOptions: ExpenseCreditAccountOption[] = [
  {
    id: "account-card",
    code: "2010",
    name: "Ministry Credit Card",
    accountType: "liability",
    displayLabel: "2010 — Ministry Credit Card",
  },
];

function renderSection(
  overrides: Partial<ComponentProps<typeof RecordExpenseSection>> = {},
) {
  return render(
    <RecordExpenseSection
      allocationComplete={overrides.allocationComplete ?? true}
      creditAccountOptions={overrides.creditAccountOptions ?? creditAccountOptions}
      expenseAmount={overrides.expenseAmount ?? 125.75}
      expenseDescription={overrides.expenseDescription ?? "Office supplies purchase"}
      expenseId={overrides.expenseId ?? "expense-123"}
      paymentSource={overrides.paymentSource ?? "card"}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecordExpenseSection", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    recordExpenseActionMock.mockResolvedValue({
      success: true,
      expenseId: "expense-123",
      status: "recorded",
      journalEntryId: "journal-456",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes mapped credit account options to RecordExpenseForm", () => {
    renderSection();

    expect(
      screen.getByRole("option", { name: "2010 — Ministry Credit Card" }),
    ).toBeInTheDocument();
  });

  it("calls recordExpenseAction with exact ids", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Payment / credit account"),
      "account-card",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(recordExpenseActionMock).toHaveBeenCalledWith({
      expenseId: "expense-123",
      creditAccountId: "account-card",
    });
  });

  it("does not pass organization or role data to the action", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Payment / credit account"),
      "account-card",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(recordExpenseActionMock.mock.calls[0]?.[0]).toEqual({
      expenseId: "expense-123",
      creditAccountId: "account-card",
    });
  });

  it("refreshes the route after a successful recording", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Payment / credit account"),
      "account-card",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("preserves user-safe action errors", async () => {
    recordExpenseActionMock.mockResolvedValue({
      success: false,
      message: "This expense has already been recorded or is no longer editable.",
    });
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Payment / credit account"),
      "account-card",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record expense" }));

    expect(
      await screen.findByText(
        "This expense has already been recorded or is no longer editable.",
      ),
    ).toHaveAttribute("role", "alert");
  });

  it("blocks recording when allocation is incomplete", () => {
    renderSection({ allocationComplete: false });

    expect(
      screen.getByRole("button", { name: "Review and record" }),
    ).toBeDisabled();
  });

  it("renders the empty eligible-account state", () => {
    renderSection({ creditAccountOptions: [] });

    expect(
      screen.getByText("No eligible payment accounts are available."),
    ).toHaveAttribute("role", "status");
  });
});
