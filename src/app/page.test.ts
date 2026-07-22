import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import Home from "./page";

afterEach(() => {
  redirectMock.mockClear();
});

describe("Home", () => {
  it("redirects the root route to dashboard", () => {
    Home();

    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("does not include login, signup, or authentication logic", () => {
    expect(Home.toString()).not.toMatch(/log in|login|sign up|signup|auth/i);
  });
});
