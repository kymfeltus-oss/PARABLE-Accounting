import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import BankingLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("BankingLoading", () => {
  it("renders the expected banking loading structure", () => {
    render(<BankingLoading />);

    expect(
      screen.getByRole("region", { name: "Loading banking" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
