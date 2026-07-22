import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBrowserSupabaseClientMock,
  pushMock,
  refreshMock,
  signInWithPasswordMock,
} = vi.hoisted(() => ({
  createBrowserSupabaseClientMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
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

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    createBrowserSupabaseClientMock.mockReturnValue({
      auth: {
        signInWithPassword: signInWithPasswordMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();

    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Email and password are required.",
    );
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("calls signInWithPassword with exact credentials", async () => {
    const user = userEvent.setup();
    signInWithPasswordMock.mockResolvedValue({ error: null });

    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "  treasurer@example.org  ");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "treasurer@example.org",
        password: "secret-password",
      });
    });
  });

  it("shows loading state while submitting", async () => {
    const user = userEvent.setup();
    let resolveSignIn: (value: { error: null }) => void = () => undefined;

    signInWithPasswordMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();

    resolveSignIn({ error: null });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    });
  });

  it("navigates to /dashboard on successful login", async () => {
    const user = userEvent.setup();
    signInWithPasswordMock.mockResolvedValue({ error: null });

    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "secret-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  it("renders safe auth error feedback", async () => {
    const user = userEvent.setup();
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "treasurer@example.org");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("links to /create-account", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/create-account",
    );
  });
});
