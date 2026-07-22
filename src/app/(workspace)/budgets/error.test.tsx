import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BudgetsError from "./error";

afterEach(() => {
  cleanup();
});

describe("BudgetsError", () => {
  it("renders a safe production error message", () => {
    render(
      <BudgetsError
        error={new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")}
        reset={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Budgets data could not be loaded",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/The Budgets workspace could not retrieve live budget data/i),
    ).toBeTruthy();
    expect(screen.queryByText(/SUPABASE_SERVICE_ROLE_KEY/i)).toBeNull();
  });

  it("provides a retry action using the error boundary reset callback", () => {
    const reset = vi.fn();

    render(
      <BudgetsError
        error={new Error("backend failure")}
        reset={reset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
