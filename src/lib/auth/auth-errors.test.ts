import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("maps invalid login credentials to a safe message", () => {
    expect(getAuthErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Invalid email or password.",
    );
  });

  it("maps user already registered to a safe message", () => {
    expect(getAuthErrorMessage({ message: "User already registered" })).toBe(
      "An account with this email already exists.",
    );
  });

  it("returns a generic message for unknown errors", () => {
    expect(getAuthErrorMessage({ message: "unexpected internal failure" })).toBe(
      "Unable to complete the request. Please try again.",
    );
  });
});
