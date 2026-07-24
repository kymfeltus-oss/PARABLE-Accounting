import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBankTransactionActionMock } = vi.hoisted(() => ({
  createBankTransactionActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/banking/actions", () => ({
  createBankTransactionAction: createBankTransactionActionMock,
}));

import { CreateBankTransactionForm } from "./create-bank-transaction-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CreateBankTransactionForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createBankTransactionActionMock.mockReset();
    createBankTransactionActionMock.mockResolvedValue({
      ok: true,
      transaction: {
        id: "bank-tx-1",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Transaction control", () => {
    render(
      <CreateBankTransactionForm
        bankAccounts={[{ id: "bank-account-1", name: "Operating Account" }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Add Transaction" })).toBeTruthy();
  });

  it("opens the sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(
      <CreateBankTransactionForm
        bankAccounts={[{ id: "bank-account-1", name: "Operating Account" }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Add Transaction" }));

    expect(
      screen.getByRole("heading", { name: "Add Bank Transaction" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Bank account")).toBeTruthy();
    expect(screen.getByLabelText("Transaction date")).toBeTruthy();
    expect(screen.getByLabelText("Amount")).toBeTruthy();
  });
});
