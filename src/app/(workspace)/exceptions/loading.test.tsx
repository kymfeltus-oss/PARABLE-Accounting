import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ExceptionsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("ExceptionsLoading", () => {
  it("renders the expected exceptions loading structure", () => {
    render(<ExceptionsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading exceptions" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
