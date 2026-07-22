import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportsError from "./error";

afterEach(() => {
  cleanup();
});

describe("ReportsError", () => {
  it("renders a safe production error message", () => {
    render(
      <ReportsError
        error={new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")}
        reset={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Reports data could not be loaded",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/The Reports workspace could not retrieve live report summaries/i),
    ).toBeTruthy();
    expect(screen.queryByText(/SUPABASE_SERVICE_ROLE_KEY/i)).toBeNull();
  });

  it("provides a retry action using the error boundary reset callback", () => {
    const reset = vi.fn();

    render(
      <ReportsError
        error={new Error("backend failure")}
        reset={reset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
