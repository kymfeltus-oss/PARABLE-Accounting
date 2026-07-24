import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createOrganizationActionMock,
  pushMock,
  refreshMock,
} = vi.hoisted(() => ({
  createOrganizationActionMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/organization/actions", () => ({
  createOrganizationAction: createOrganizationActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import { CreateOrganizationForm } from "./create-organization-form";

describe("CreateOrganizationForm", () => {
  beforeEach(() => {
    createOrganizationActionMock.mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders ministry name and ministry web name fields", () => {
    render(<CreateOrganizationForm />);

    expect(screen.getByLabelText("Ministry name")).toBeInTheDocument();
    expect(screen.getByLabelText("Ministry web name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set up my ministry" }),
    ).toBeInTheDocument();
  });

  it("shows action errors without navigating", async () => {
    const user = userEvent.setup();
    createOrganizationActionMock.mockResolvedValue({
      ok: false,
      error: "Ministry name is required.",
    });

    render(<CreateOrganizationForm />);

    await user.type(screen.getByLabelText("Ministry name"), " ");
    await user.click(screen.getByRole("button", { name: "Set up my ministry" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ministry name is required.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("navigates to /dashboard after a successful create", async () => {
    const user = userEvent.setup();
    createOrganizationActionMock.mockResolvedValue({
      ok: true,
      organizationId: "22222222-2222-4222-8222-222222222222",
    });

    render(<CreateOrganizationForm />);

    await user.type(screen.getByLabelText("Ministry name"), "Grace Church");
    await user.type(
      screen.getByLabelText("Ministry web name"),
      "grace-church",
    );
    await user.click(screen.getByRole("button", { name: "Set up my ministry" }));

    await waitFor(() => {
      expect(createOrganizationActionMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
