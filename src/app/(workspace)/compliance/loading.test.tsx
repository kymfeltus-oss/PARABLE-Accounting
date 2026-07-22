import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ComplianceLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("ComplianceLoading", () => {
  it("renders the expected compliance loading structure", () => {
    render(<ComplianceLoading />);

    expect(
      screen.getByRole("region", { name: "Loading compliance" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
