import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const { createBankAccountActionMock } = vi.hoisted(() => ({
  createBankAccountActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/banking/actions", () => ({
  createBankAccountAction: createBankAccountActionMock,
}));

import { CreateBankAccountForm } from "./create-bank-account-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CreateBankAccountForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createBankAccountActionMock.mockReset();
    createBankAccountActionMock.mockResolvedValue({
      ok: true,
      bankAccount: {
        id: "bank-account-1",
        organization_id: TEST_ORGANIZATION_ID,
        account_id: "account-1",
        name: "Ministry Savings",
        institution_name: null,
        account_type: "savings",
        last_four: null,
        status: "active",
        created_at: "2026-07-24T12:00:00.000Z",
        updated_at: "2026-07-24T12:00:00.000Z",
        ledgerBalance: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Bank Account control", () => {
    render(
      <CreateBankAccountForm
        assetAccounts={[
          { id: "account-1", code: "1000", name: "Operating Checking" },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add Bank Account" }),
    ).toBeTruthy();
  });

  it("opens the sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(
      <CreateBankAccountForm
        assetAccounts={[
          { id: "account-1", code: "1000", name: "Operating Checking" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add Bank Account" }));

    expect(
      screen.getByRole("heading", { name: "Add Bank Account" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Account name")).toBeTruthy();
    expect(screen.getByLabelText("Chart account")).toBeTruthy();
  });
});
