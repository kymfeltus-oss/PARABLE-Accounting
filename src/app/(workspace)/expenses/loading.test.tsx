import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ExpensesLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("ExpensesLoading", () => {
  it("renders the expected expenses loading structure", () => {
    render(<ExpensesLoading />);

    expect(
      screen.getByRole("region", { name: "Loading expenses" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
