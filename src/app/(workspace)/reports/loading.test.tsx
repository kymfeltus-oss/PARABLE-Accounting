import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ReportsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("ReportsLoading", () => {
  it("renders the expected reports loading structure", () => {
    render(<ReportsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading reports" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
