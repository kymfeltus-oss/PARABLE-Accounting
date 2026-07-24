import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const { createFundActionMock } = vi.hoisted(() => ({
  createFundActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/funds/actions", () => ({
  createFundAction: createFundActionMock,
}));

import { CreateFundForm } from "./create-fund-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CreateFundForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createFundActionMock.mockReset();
    createFundActionMock.mockResolvedValue({
      ok: true,
      fund: {
        id: "55555555-5555-5555-8555-555555555555",
        organization_id: TEST_ORGANIZATION_ID,
        name: "General Fund",
        code: "GEN",
        fund_type: "unrestricted",
        status: "active",
        created_at: "2026-07-24T12:00:00.000Z",
        updated_at: "2026-07-24T12:00:00.000Z",
        givingTransactionCount: 0,
        givingTotalAmount: 0,
        expenseLineCount: 0,
        expenseAllocationTotal: 0,
        billLineCount: 0,
        billAllocationTotal: 0,
        budgetLineCount: 0,
        budgetAllocationTotal: 0,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the Add Fund control", () => {
    render(<CreateFundForm />);

    expect(screen.getByRole("button", { name: "Add Fund" })).toBeTruthy();
  });

  it("opens the create-fund sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(<CreateFundForm />);
    await user.click(screen.getByRole("button", { name: "Add Fund" }));

    expect(screen.getByRole("heading", { name: "Add Fund" })).toBeTruthy();
    expect(screen.getByLabelText("Fund name")).toBeTruthy();
    expect(screen.getByLabelText("Fund code")).toBeTruthy();
    expect(screen.getByLabelText("Fund type")).toBeTruthy();
  });
});
