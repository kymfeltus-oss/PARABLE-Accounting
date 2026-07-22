import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import VendorsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("VendorsLoading", () => {
  it("renders the expected vendors loading structure", () => {
    render(<VendorsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading vendors" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
