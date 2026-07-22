import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DashboardLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("DashboardLoading", () => {
  it("renders the expected dashboard loading structure", () => {
    render(<DashboardLoading />);

    expect(
      screen.getByRole("region", { name: "Loading dashboard" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
