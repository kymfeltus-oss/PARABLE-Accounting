import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import AuditVaultLoading from "./loading";

afterEach(() => {
  cleanup();
});

describe("AuditVaultLoading", () => {
  it("renders the expected audit vault loading structure", () => {
    render(<AuditVaultLoading />);

    expect(
      screen.getByRole("region", { name: "Loading audit vault" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
