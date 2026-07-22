import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BudgetsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("BudgetsLoading", () => {
  it("renders the expected budgets loading structure", () => {
    render(<BudgetsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading budgets" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
