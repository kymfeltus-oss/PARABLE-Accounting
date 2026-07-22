import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AccountingLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("AccountingLoading", () => {
  it("renders the expected accounting loading structure", () => {
    render(<AccountingLoading />);

    expect(
      screen.getByRole("region", { name: "Loading accounting" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
