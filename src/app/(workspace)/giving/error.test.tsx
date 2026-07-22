import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GivingError from "./error";

afterEach(() => {
  cleanup();
});

describe("GivingError", () => {
  it("renders a safe production error message", () => {
    render(
      <GivingError
        error={new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")}
        reset={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Giving data could not be loaded",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/The Giving workspace could not retrieve live financial data/i),
    ).toBeTruthy();
    expect(screen.queryByText(/SUPABASE_SERVICE_ROLE_KEY/i)).toBeNull();
  });

  it("provides a retry action using the error boundary reset callback", () => {
    const reset = vi.fn();

    render(
      <GivingError
        error={new Error("backend failure")}
        reset={reset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
