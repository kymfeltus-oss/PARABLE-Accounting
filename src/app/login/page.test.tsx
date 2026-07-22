import { describe, expect, it, vi } from "vitest";

const { getAuthenticatedUserMock, redirectMock } = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  redirectMock: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/auth/get-authenticated-user", () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => "LoginForm",
}));

import LoginPage from "./page";
import { LoginForm } from "@/components/auth/login-form";

describe("Login page route", () => {
  it("exists and renders LoginForm for unauthenticated users", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const page = await LoginPage();

    expect(page.type).toBe("main");
    expect(page.props.children.type).toBe(LoginForm);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to /dashboard", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });

    await expect(LoginPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
