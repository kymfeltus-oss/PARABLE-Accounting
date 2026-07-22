import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GivingLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("GivingLoading", () => {
  it("renders the expected giving loading structure", () => {
    render(<GivingLoading />);

    expect(
      screen.getByRole("region", { name: "Loading giving" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
