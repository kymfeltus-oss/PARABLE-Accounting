import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AICloseLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("AICloseLoading", () => {
  it("renders the expected AI Close loading structure", () => {
    render(<AICloseLoading />);

    expect(
      screen.getByRole("region", { name: "Loading AI Close" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
