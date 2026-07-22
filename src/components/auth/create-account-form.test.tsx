import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBrowserSupabaseClientMock,
  pushMock,
  refreshMock,
  signUpMock,
} = vi.hoisted(() => ({
  createBrowserSupabaseClientMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signUpMock: vi.fn(),
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

import { CreateAccountForm } from "./create-account-form";

describe("CreateAccountForm", () => {
  beforeEach(() => {
    createBrowserSupabaseClientMock.mockReturnValue({
      auth: {
        signUp: signUpMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders email, password, and confirm password fields", () => {
    render(<CreateAccountForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("rejects password mismatch", async () => {
    const user = userEvent.setup();

    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "password-one");
    await user.type(screen.getByLabelText("Confirm password"), "password-two");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("calls signUp with exact email and password", async () => {
    const user = userEvent.setup();
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null,
    });

    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText("Email"), "  treasurer@example.org  ");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith({
        email: "treasurer@example.org",
        password: "secret-password",
      });
    });
  });

  it("navigates to /dashboard when signup returns an immediate session", async () => {
    const user = userEvent.setup();
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "token" }, user: { id: "user-1" } },
      error: null,
    });

    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("shows email confirmation success when no session is returned", async () => {
    const user = userEvent.setup();
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "user-1" } },
      error: null,
    });

    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email to confirm your account before signing in.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("renders safe auth error feedback", async () => {
    const user = userEvent.setup();
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "User already registered" },
    });

    render(<CreateAccountForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.type(screen.getByLabelText("Confirm password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists.",
    );
  });

  it("links to /login", () => {
    render(<CreateAccountForm />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
