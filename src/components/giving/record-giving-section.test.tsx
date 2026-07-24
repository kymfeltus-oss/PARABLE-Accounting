import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecordGivingSection } from "./record-giving-section";

const refreshMock = vi.fn();

const { recordGivingActionMock } = vi.hoisted(() => ({
  recordGivingActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("@/app/(workspace)/giving/actions", () => ({
  recordGivingAction: recordGivingActionMock,
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const debitAccountOptions = [
  {
    id: "acct-asset",
    code: "1000",
    name: "Operating Checking",
    accountType: "asset" as const,
    displayLabel: "1000 — Operating Checking",
  },
];

const revenueAccountOptions = [
  {
    id: "acct-revenue",
    code: "4000",
    name: "General Contributions",
    accountType: "revenue" as const,
    displayLabel: "4000 — General Contributions",
  },
];

function renderSection(
  overrides: Partial<ComponentProps<typeof RecordGivingSection>> = {},
) {
  return render(
    <RecordGivingSection
      amount={overrides.amount ?? 250}
      debitAccountOptions={overrides.debitAccountOptions ?? debitAccountOptions}
      givingMethod={overrides.givingMethod ?? "check"}
      givingTransactionId={overrides.givingTransactionId ?? "gift-123"}
      revenueAccountOptions={
        overrides.revenueAccountOptions ?? revenueAccountOptions
      }
      transactionLabel={overrides.transactionLabel ?? "CHK-1001"}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecordGivingSection", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    recordGivingActionMock.mockResolvedValue({
      success: true,
      givingTransactionId: "gift-123",
      status: "recorded",
      journalEntryId: "journal-456",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes mapped account options to RecordGivingForm", () => {
    renderSection();

    expect(
      screen.getByRole("option", { name: "1000 — Operating Checking" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "4000 — General Contributions" }),
    ).toBeInTheDocument();
  });

  it("calls recordGivingAction with exact ids", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Debit account"),
      "acct-asset",
    );
    await user.selectOptions(
      screen.getByLabelText("Revenue account"),
      "acct-revenue",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record giving" }));

    expect(recordGivingActionMock).toHaveBeenCalledWith({
      givingTransactionId: "gift-123",
      debitAccountId: "acct-asset",
      creditAccountId: "acct-revenue",
    });
  });

  it("refreshes the page after a successful record", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.selectOptions(
      screen.getByLabelText("Debit account"),
      "acct-asset",
    );
    await user.selectOptions(
      screen.getByLabelText("Revenue account"),
      "acct-revenue",
    );
    await user.click(screen.getByRole("button", { name: "Review and record" }));
    await user.click(screen.getByRole("button", { name: "Record giving" }));

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
