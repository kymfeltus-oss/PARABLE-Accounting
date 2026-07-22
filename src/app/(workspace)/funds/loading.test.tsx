import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FundsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("FundsLoading", () => {
  it("renders the expected funds loading structure", () => {
    render(<FundsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading funds" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
