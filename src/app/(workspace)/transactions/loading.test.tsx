import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TransactionsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("TransactionsLoading", () => {
  it("renders the expected transactions loading structure", () => {
    render(<TransactionsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading transactions" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
