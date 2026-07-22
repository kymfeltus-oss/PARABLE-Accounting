import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SettingsLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("SettingsLoading", () => {
  it("renders the expected settings loading structure", () => {
    render(<SettingsLoading />);

    expect(
      screen.getByRole("region", { name: "Loading settings" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
