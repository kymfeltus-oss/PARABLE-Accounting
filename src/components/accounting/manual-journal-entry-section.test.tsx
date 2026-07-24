import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createManualJournalActionMock } = vi.hoisted(() => ({
  createManualJournalActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/accounting/actions", () => ({
  createManualJournalAction: createManualJournalActionMock,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ManualJournalEntrySection } from "./manual-journal-entry-section";

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
];

async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Entry date"), "2026-07-23");
  const accountInputs = screen.getAllByLabelText("Account");
  await user.selectOptions(accountInputs[0], "expense-account");
  await user.selectOptions(accountInputs[1], "cash-account");
  await user.type(screen.getAllByLabelText("Debit")[0], "125.50");
  await user.type(screen.getAllByLabelText("Credit")[1], "125.50");
  await user.type(screen.getByLabelText("Description"), "Monthly close");
  return user;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ManualJournalEntrySection", () => {
  it("invokes the server action with the normalized payload", async () => {
    createManualJournalActionMock.mockResolvedValue({
      success: true,
      journalEntryId: "journal-123",
      entryNumber: "MAN-TEST-001",
    });

    render(
      <ManualJournalEntrySection
        accounts={accounts}
        funds={funds}
        periods={periods}
      />,
    );

    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));

    await waitFor(() => {
      expect(createManualJournalActionMock).toHaveBeenCalledWith({
        entryDate: "2026-07-23",
        description: "Monthly close",
        periodId: "open-period",
        lines: [
          {
            accountId: "expense-account",
            description: null,
            debit: 125.5,
            credit: 0,
            fundId: null,
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
    });
  });

  it("shows register and detail navigation after success", async () => {
    createManualJournalActionMock.mockResolvedValue({
      success: true,
      journalEntryId: "journal-123",
      entryNumber: "MAN-TEST-001",
    });

    render(
      <ManualJournalEntrySection
        accounts={accounts}
        funds={funds}
        periods={periods}
      />,
    );

    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));

    expect(await screen.findByText(/MAN-TEST-001/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Back to journal register" }),
    ).toHaveAttribute("href", "/accounting/journals");
    expect(
      screen.getByRole("link", { name: "View journal entry" }),
    ).toHaveAttribute("href", "/accounting/journals/journal-123");
  });

  it("renders safe server errors without exposing raw backend details", async () => {
    createManualJournalActionMock.mockResolvedValue({
      success: false,
      message: "The selected accounting period is closed.",
    });

    render(
      <ManualJournalEntrySection
        accounts={accounts}
        funds={funds}
        periods={periods}
      />,
    );

    const user = await fillValidForm();
    await user.click(screen.getByRole("button", { name: "Create journal entry" }));

    expect(
      await screen.findByText("The selected accounting period is closed."),
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/record_manual_journal/i)).not.toBeInTheDocument();
  });
});
