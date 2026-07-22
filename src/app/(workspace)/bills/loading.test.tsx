import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BillsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("BillsLoading", () => {
  it("renders the expected bills loading structure", () => {
    render(<BillsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading bills" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
