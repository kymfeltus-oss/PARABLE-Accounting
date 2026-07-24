import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_ORGANIZATION_ID } from "@/lib/data/test/mock-supabase-client";

const { createMemberActionMock } = vi.hoisted(() => ({
  createMemberActionMock: vi.fn(),
}));

vi.mock("@/app/(workspace)/members/actions", () => ({
  createMemberAction: createMemberActionMock,
}));

import { CreateMemberForm } from "./create-member-form";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CreateMemberForm", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    createMemberActionMock.mockReset();
    createMemberActionMock.mockResolvedValue({
      ok: true,
      member: {
        id: "66666666-6666-6666-8666-666666666666",
        organization_id: TEST_ORGANIZATION_ID,
        first_name: "Jordan",
        last_name: "Lee",
        email: "jordan.lee@example.org",
        phone: "555-0100",
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

  it("renders the Add Member control", () => {
    render(<CreateMemberForm />);

    expect(screen.getByRole("button", { name: "Add Member" })).toBeTruthy();
  });

  it("opens the create-member sheet and renders required fields", async () => {
    const user = userEvent.setup();

    render(<CreateMemberForm />);
    await user.click(screen.getByRole("button", { name: "Add Member" }));

    expect(screen.getByRole("heading", { name: "Add Member" })).toBeTruthy();
    expect(screen.getByLabelText("First name")).toBeTruthy();
    expect(screen.getByLabelText("Last name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
  });
});
