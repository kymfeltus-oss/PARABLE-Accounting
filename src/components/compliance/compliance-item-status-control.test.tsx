import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONTROL_PATH = path.join(
  process.cwd(),
  "src/components/compliance/compliance-item-status-control.tsx",
);

const TEST_ITEM_ID = "22222222-2222-4222-8222-222222222222";

const updatedItem = {
  id: TEST_ITEM_ID,
  organization_id: "11111111-1111-4111-8111-111111111111",
  name: "Form 990 filing",
  category: "federal_tax",
  due_date: "2026-05-15",
  status: "completed",
  description: "Prepare annual federal tax filing.",
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: "2026-07-20T18:00:00.000Z",
};

const { updateComplianceItemStatusActionMock } = vi.hoisted(() => ({
  updateComplianceItemStatusActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/compliance/actions", () => ({
  updateComplianceItemStatusAction: updateComplianceItemStatusActionMock,
}));

import { ComplianceItemStatusControl } from "./compliance-item-status-control";

afterEach(() => {
  cleanup();
  updateComplianceItemStatusActionMock.mockReset();
});

describe("ComplianceItemStatusControl", () => {
  beforeEach(() => {
    updateComplianceItemStatusActionMock.mockResolvedValue({
      ok: true,
      item: updatedItem,
    });
  });

  it("displays the current status", () => {
    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    expect(screen.getByRole("combobox", { name: "Compliance item status" })).toHaveValue(
      "open",
    );
  });

  it("offers all valid status options", () => {
    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    const options = screen.getAllByRole("option");

    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "open",
      "completed",
      "not_applicable",
    ]);
    expect(options.map((option) => option.textContent)).toEqual([
      "open",
      "completed",
      "not applicable",
    ]);
  });

  it("calls the server action with itemId and nextStatus only", async () => {
    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Compliance item status" }), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      expect(updateComplianceItemStatusActionMock).toHaveBeenCalledWith({
        itemId: TEST_ITEM_ID,
        nextStatus: "completed",
      });
    });
  });

  it("does not send organizationId to the server action", async () => {
    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Compliance item status" }), {
      target: { value: "not_applicable" },
    });

    await waitFor(() => {
      expect(updateComplianceItemStatusActionMock).toHaveBeenCalledTimes(1);
    });

    const callArgument = updateComplianceItemStatusActionMock.mock.calls[0][0];
    expect(callArgument).not.toHaveProperty("organizationId");
    expect(Object.keys(callArgument)).toEqual(["itemId", "nextStatus"]);
  });

  it("disables the control while the update is pending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    updateComplianceItemStatusActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    const select = screen.getByRole("combobox", {
      name: "Compliance item status",
    }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "completed" } });

    await waitFor(() => {
      expect(select.disabled).toBe(true);
    });
    expect(screen.getByText("Updating status...")).toBeTruthy();

    resolveAction({ ok: true, item: updatedItem });

    await waitFor(() => {
      expect(select.disabled).toBe(false);
    });
  });

  it("updates the visible status after a successful action", async () => {
    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Compliance item status" }), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: "Compliance item status" }),
      ).toHaveValue("completed");
    });
  });

  it("shows a safe inline error and restores the prior status on failure", async () => {
    updateComplianceItemStatusActionMock.mockResolvedValue({
      ok: false,
      error:
        "Unable to update compliance item status. Please verify your access and try again.",
    });

    render(<ComplianceItemStatusControl itemId={TEST_ITEM_ID} status="open" />);

    fireEvent.change(screen.getByRole("combobox", { name: "Compliance item status" }), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to update compliance item status. Please verify your access and try again.",
      );
    });
    expect(
      screen.getByRole("combobox", { name: "Compliance item status" }),
    ).toHaveValue("open");
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
