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

vi.mock("@/components/auth/create-account-form", () => ({
  CreateAccountForm: () => "CreateAccountForm",
}));

import CreateAccountPage from "./page";
import { CreateAccountForm } from "@/components/auth/create-account-form";

describe("Create account page route", () => {
  it("exists and renders CreateAccountForm for unauthenticated users", async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const page = await CreateAccountPage();

    expect(page.type).toBe("main");
    expect(page.props.children.type).toBe(CreateAccountForm);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects authenticated users to /dashboard", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ id: "user-1" });

    await expect(CreateAccountPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
