import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONTROL_PATH = path.join(
  process.cwd(),
  "src/components/exceptions/exception-status-control.tsx",
);

const TEST_EXCEPTION_ID = "33333333-3333-4333-8333-333333333333";

const updatedException = {
  id: TEST_EXCEPTION_ID,
  organization_id: "11111111-1111-4111-8111-111111111111",
  source_type: "bank_transaction",
  source_id: "bank-tx-1",
  category: "banking",
  severity: "high",
  title: "Unmatched bank deposit",
  description: "Deposit has no confirmed match.",
  status: "resolved",
  created_at: "2026-07-10T12:00:00.000Z",
  updated_at: "2026-07-20T18:00:00.000Z",
};

const { updateExceptionStatusActionMock } = vi.hoisted(() => ({
  updateExceptionStatusActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/exceptions/actions", () => ({
  updateExceptionStatusAction: updateExceptionStatusActionMock,
}));

import { ExceptionStatusControl } from "./exception-status-control";

afterEach(() => {
  cleanup();
  updateExceptionStatusActionMock.mockReset();
});

describe("ExceptionStatusControl", () => {
  beforeEach(() => {
    updateExceptionStatusActionMock.mockResolvedValue({
      ok: true,
      item: updatedException,
    });
  });

  it("displays the current status", () => {
    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    expect(screen.getByRole("combobox", { name: "Exception status" })).toHaveValue(
      "open",
    );
  });

  it("offers all valid status options", () => {
    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    const options = screen.getAllByRole("option");

    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "open",
      "resolved",
      "dismissed",
    ]);
    expect(options.map((option) => option.textContent)).toEqual([
      "open",
      "resolved",
      "dismissed",
    ]);
  });

  it("calls the server action with exceptionId and nextStatus only", async () => {
    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Exception status" }), {
      target: { value: "resolved" },
    });

    await waitFor(() => {
      expect(updateExceptionStatusActionMock).toHaveBeenCalledWith({
        exceptionId: TEST_EXCEPTION_ID,
        nextStatus: "resolved",
      });
    });
  });

  it("does not send organizationId to the server action", async () => {
    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Exception status" }), {
      target: { value: "dismissed" },
    });

    await waitFor(() => {
      expect(updateExceptionStatusActionMock).toHaveBeenCalledTimes(1);
    });

    const callArgument = updateExceptionStatusActionMock.mock.calls[0][0];
    expect(callArgument).not.toHaveProperty("organizationId");
    expect(Object.keys(callArgument)).toEqual(["exceptionId", "nextStatus"]);
  });

  it("disables the control while the update is pending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    updateExceptionStatusActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    const select = screen.getByRole("combobox", {
      name: "Exception status",
    }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "resolved" } });

    await waitFor(() => {
      expect(select.disabled).toBe(true);
    });
    expect(screen.getByText("Updating status...")).toBeTruthy();

    resolveAction({ ok: true, item: updatedException });

    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
  });

  it("updates the visible status after a successful action", async () => {
    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Exception status" }), {
      target: { value: "resolved" },
    });

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Exception status" })).toHaveValue(
        "resolved",
      );
    });
  });

  it("shows a safe inline error and restores the prior status on failure", async () => {
    updateExceptionStatusActionMock.mockResolvedValue({
      ok: false,
      error:
        "Unable to update exception status. Please verify your access and try again.",
    });

    render(
      <ExceptionStatusControl exceptionId={TEST_EXCEPTION_ID} status="open" />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Exception status" }), {
      target: { value: "resolved" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to update exception status. Please verify your access and try again.",
      );
    });
    expect(screen.getByRole("combobox", { name: "Exception status" })).toHaveValue(
      "open",
    );
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /insufficient role|postgres|supabase/i,
    );
  });

  it("does not use a direct Supabase browser client", () => {
    const contents = readFileSync(CONTROL_PATH, "utf8");

    expect(contents).not.toContain("createBrowserSupabaseClient");
    expect(contents).not.toContain("createClient");
    expect(contents).not.toContain("@/lib/supabase/admin");
    expect(contents).not.toMatch(/supabase\.from\(/);
    expect(contents).not.toMatch(/\.update\(/);
  });
});
