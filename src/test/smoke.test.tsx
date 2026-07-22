import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("renders a minimal React element in jsdom", () => {
    render(<p>Test environment ready</p>);

    expect(screen.getByText("Test environment ready")).toBeInTheDocument();
  });
});
