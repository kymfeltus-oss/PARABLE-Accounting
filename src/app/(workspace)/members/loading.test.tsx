import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MembersLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("MembersLoading", () => {
  it("renders the expected members loading structure", () => {
    render(<MembersLoading />);

    expect(
      screen.getByRole("region", { name: "Loading members" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
