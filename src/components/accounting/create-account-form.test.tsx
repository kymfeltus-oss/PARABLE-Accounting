import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const {
  createAccountActionMock,
  createAccountingPeriodActionMock,
  closeAccountingPeriodActionMock,
} = vi.hoisted(() => ({
  createAccountActionMock: vi.fn(),
  createAccountingPeriodActionMock: vi.fn(),
  closeAccountingPeriodActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/accounting/actions", () => ({
  createAccountAction: createAccountActionMock,
  createAccountingPeriodAction: createAccountingPeriodActionMock,
  closeAccountingPeriodAction: closeAccountingPeriodActionMock,
}));

import { CreateAccountForm } from "./create-account-form";
import { CreateAccountingPeriodForm } from "./create-accounting-period-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CreateAccountForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createAccountActionMock.mockReset();
    createAccountActionMock.mockResolvedValue({
      ok: true,
      account: {
        id: "77777777-7777-7777-8777-777777777777",
        organization_id: TEST_ORGANIZATION_ID,
        parent_account_id: null,
        code: "1000",
        name: "Operating Cash",
        account_type: "asset",
        is_posting: true,
        status: "active",
        created_at: "2026-07-24T12:00:00.000Z",
        updated_at: "2026-07-24T12:00:00.000Z",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Account control", () => {
    render(<CreateAccountForm />);

    expect(screen.getByRole("button", { name: "Add Account" })).toBeTruthy();
  });

  it("opens the create-account sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(<CreateAccountForm />);
    await user.click(screen.getByRole("button", { name: "Add Account" }));

    expect(screen.getByRole("heading", { name: "Add Account" })).toBeTruthy();
    expect(screen.getByLabelText("Account code")).toBeTruthy();
    expect(screen.getByLabelText("Account name")).toBeTruthy();
    expect(screen.getByLabelText("Account type")).toBeTruthy();
  });
});

describe("CreateAccountingPeriodForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createAccountingPeriodActionMock.mockReset();
    createAccountingPeriodActionMock.mockResolvedValue({
      ok: true,
      period: {
        id: "88888888-8888-8888-8888-888888888888",
        organization_id: TEST_ORGANIZATION_ID,
        name: "July 2026",
        start_date: "2026-07-01",
        end_date: "2026-07-31",
        status: "open",
        created_at: "2026-07-01T12:00:00.000Z",
        updated_at: "2026-07-01T12:00:00.000Z",
        isCurrent: true,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Period control", () => {
    render(<CreateAccountingPeriodForm />);

    expect(screen.getByRole("button", { name: "Add Period" })).toBeTruthy();
  });

  it("opens the create-period sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(<CreateAccountingPeriodForm />);
    await user.click(screen.getByRole("button", { name: "Add Period" }));

    expect(
      screen.getByRole("heading", { name: "Add Accounting Period" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Period name")).toBeTruthy();
    expect(screen.getByLabelText("Start date")).toBeTruthy();
    expect(screen.getByLabelText("End date")).toBeTruthy();
  });
});
