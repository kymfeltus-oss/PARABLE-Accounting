import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBrowserSupabaseClientMock,
  pushMock,
  refreshMock,
  signOutMock,
} = vi.hoisted(() => ({
  createBrowserSupabaseClientMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: createBrowserSupabaseClientMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

import { SignOutButton } from "./sign-out-button";

describe("SignOutButton", () => {
  beforeEach(() => {
    createBrowserSupabaseClientMock.mockReturnValue({
      auth: {
        signOut: signOutMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls supabase.auth.signOut()", async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue({ error: null });

    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows loading state while signing out", async () => {
    const user = userEvent.setup();
    let resolveSignOut: (value: { error: null }) => void = () => undefined;

    signOutMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignOut = resolve;
        }),
    );

    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();

    resolveSignOut({ error: null });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    });
  });

  it("navigates to /login on successful sign out", async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue({ error: null });

    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/login");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("renders safe error feedback when sign out fails", async () => {
    const user = userEvent.setup();
    signOutMock.mockResolvedValue({
      error: { message: "Unable to sign out" },
    });

    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to complete the request. Please try again.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
